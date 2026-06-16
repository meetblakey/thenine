import { createGroupVouch, updateGroupVouch } from "@thenine/domain";
import { DomainInvariantError } from "@thenine/domain/group-eligibility";
import type { GroupVouch, GroupVouchMembership, GroupVouchWriteResult, ModerationStatus } from "@thenine/domain";
import { ApiRouteError } from "./launchpad-route.js";
import type { ApiErrorCode } from "./launchpad-route.js";

export const POST_GROUP_VOUCH_ROUTE = {
  method: "POST",
  path: "/v1/groups/{groupId}/vouches",
  auth: "Group member",
  requiresIdempotencyKey: true
} as const;

export const PATCH_GROUP_VOUCH_ROUTE = {
  method: "PATCH",
  path: "/v1/groups/{groupId}/vouches/{vouchId}",
  auth: "Group member",
  requiresIdempotencyKey: true
} as const;

export interface GroupProfileMutationMember {
  memberId: string;
}

export interface GroupProfileMutationContext {
  member: GroupProfileMutationMember | null;
  idempotencyKey: string | null;
}

export interface PostGroupVouchBody {
  subjectMemberId: string;
  body: string;
}

export interface PatchGroupVouchBody {
  body?: string;
  subjectApproved?: boolean;
  hidden?: boolean;
}

export interface GroupVouchAccess {
  activeMemberIds: string[];
}

export interface GroupVouchModerationInput {
  groupId: string;
  authorMemberId: string;
  subjectMemberId: string;
  body: string;
}

export interface PostGroupVouchDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadGroupVouchAccess: (groupId: string, memberId: string) => Promise<GroupVouchAccess>;
  moderateGroupVouch: (
    input: GroupVouchModerationInput
  ) => Promise<{ status: Extract<ModerationStatus, "approved" | "held_for_review" | "rejected">; reasonCode: string | null }>;
  nextVouchId: () => string;
  now: () => Date;
  persistGroupVouch: (input: GroupVouchWriteResult) => Promise<GroupVouch>;
}

export interface PatchGroupVouchDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadGroupVouchUpdateContext: (
    groupId: string,
    vouchId: string,
    memberId: string
  ) => Promise<{ vouch: GroupVouch; activeMemberIds: string[] }>;
  moderateGroupVouch: (
    input: GroupVouchModerationInput
  ) => Promise<{ status: Extract<ModerationStatus, "approved" | "held_for_review" | "rejected">; reasonCode: string | null }>;
  now: () => Date;
  persistGroupVouchUpdate: (input: GroupVouchWriteResult) => Promise<GroupVouch>;
}

export async function handlePostGroupVouch(
  context: GroupProfileMutationContext,
  params: { groupId: string },
  body: PostGroupVouchBody,
  dependencies: PostGroupVouchDependencies
): Promise<{ id: string; moderationStatus: ModerationStatus; subjectApprovedAt: string | null }> {
  const member = requireGroupProfileMember(context.member);
  await reserveRequiredGroupProfileIdempotency(
    POST_GROUP_VOUCH_ROUTE.method,
    POST_GROUP_VOUCH_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  try {
    const access = await dependencies.loadGroupVouchAccess(params.groupId, member.memberId);
    const normalizedBody = normalizeRouteBody(body.body);
    const moderation = await dependencies.moderateGroupVouch({
      groupId: params.groupId,
      authorMemberId: member.memberId,
      subjectMemberId: body.subjectMemberId,
      body: normalizedBody
    });
    const vouchWrite = createGroupVouch({
      vouchId: dependencies.nextVouchId(),
      groupId: params.groupId,
      authorMemberId: member.memberId,
      subjectMemberId: body.subjectMemberId,
      body: normalizedBody,
      groupMembers: groupMembersFromAccess(access),
      moderation,
      createdAt: dependencies.now().toISOString()
    });
    const persistedVouch = await dependencies.persistGroupVouch(vouchWrite);

    if (vouchWrite.outboxEvent.eventName === "group.vouch_held") {
      throw new ApiRouteError("MESSAGE_MODERATION_HELD", "Vouch blurb was held for moderation review.");
    }

    return toPostGroupVouchResponse(persistedVouch);
  } catch (error) {
    throw mapGroupProfileDomainError(error);
  }
}

export async function handlePatchGroupVouch(
  context: GroupProfileMutationContext,
  params: { groupId: string; vouchId: string },
  body: PatchGroupVouchBody,
  dependencies: PatchGroupVouchDependencies
): Promise<{ id: string; moderationStatus: ModerationStatus; subjectApprovedAt: string | null; hiddenAt: string | null }> {
  const member = requireGroupProfileMember(context.member);
  await reserveRequiredGroupProfileIdempotency(
    PATCH_GROUP_VOUCH_ROUTE.method,
    PATCH_GROUP_VOUCH_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  try {
    const updateContext = await dependencies.loadGroupVouchUpdateContext(params.groupId, params.vouchId, member.memberId);
    const normalizedBody = body.body === undefined ? null : normalizeRouteBody(body.body);
    const moderation =
      normalizedBody === null
        ? null
        : await dependencies.moderateGroupVouch({
            groupId: params.groupId,
            authorMemberId: updateContext.vouch.authorMemberId,
            subjectMemberId: updateContext.vouch.subjectMemberId,
            body: normalizedBody
          });
    const vouchWrite = updateGroupVouch({
      vouch: updateContext.vouch,
      actorMemberId: member.memberId,
      groupMembers: groupMembersFromAccess(updateContext),
      ...(normalizedBody === null ? {} : { body: normalizedBody }),
      ...(body.subjectApproved === undefined ? {} : { subjectApproved: body.subjectApproved }),
      ...(body.hidden === undefined ? {} : { hidden: body.hidden }),
      ...(moderation === null ? {} : { moderation }),
      updatedAt: dependencies.now().toISOString()
    });
    const persistedVouch = await dependencies.persistGroupVouchUpdate(vouchWrite);

    if (vouchWrite.outboxEvent.eventName === "group.vouch_held") {
      throw new ApiRouteError("MESSAGE_MODERATION_HELD", "Vouch blurb was held for moderation review.");
    }

    return toPatchGroupVouchResponse(persistedVouch);
  } catch (error) {
    throw mapGroupProfileDomainError(error);
  }
}

function requireGroupProfileMember(member: GroupProfileMutationMember | null): GroupProfileMutationMember {
  if (member === null) {
    throw new ApiRouteError("UNAUTHENTICATED", "Group profile routes require a member session.");
  }

  return member;
}

async function reserveRequiredGroupProfileIdempotency(
  method: string,
  path: string,
  context: GroupProfileMutationContext,
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>
): Promise<void> {
  if (context.idempotencyKey === null || context.idempotencyKey.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Mutating routes require Idempotency-Key.");
  }

  const member = requireGroupProfileMember(context.member);
  await reserveIdempotencyKey(`${method} ${path}`, context.idempotencyKey, member.memberId);
}

function normalizeRouteBody(body: string): string {
  const normalizedBody = body.trim();

  if (normalizedBody === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Vouch body is required.");
  }

  return normalizedBody;
}

function groupMembersFromAccess(access: { activeMemberIds: string[] }): GroupVouchMembership[] {
  return access.activeMemberIds.map((memberId) => ({ memberId, membershipStatus: "active" }));
}

function toPostGroupVouchResponse(vouch: GroupVouch): { id: string; moderationStatus: ModerationStatus; subjectApprovedAt: string | null } {
  return {
    id: vouch.id,
    moderationStatus: vouch.moderationStatus,
    subjectApprovedAt: vouch.subjectApprovedAt
  };
}

function toPatchGroupVouchResponse(vouch: GroupVouch): {
  id: string;
  moderationStatus: ModerationStatus;
  subjectApprovedAt: string | null;
  hiddenAt: string | null;
} {
  return {
    id: vouch.id,
    moderationStatus: vouch.moderationStatus,
    subjectApprovedAt: vouch.subjectApprovedAt,
    hiddenAt: vouch.hiddenAt
  };
}

function mapGroupProfileDomainError(error: unknown): Error {
  if (error instanceof DomainInvariantError) {
    return new ApiRouteError(error.code as ApiErrorCode, error.message);
  }

  return error instanceof Error ? error : new ApiRouteError("UNPROCESSABLE_STATE", "Unexpected Group profile route failure.");
}
