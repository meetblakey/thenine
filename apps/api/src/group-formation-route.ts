import {
  acceptGroupInvite,
  approveGroupPublication,
  buildGroupInvitePreview,
  buildGroupResourceForMember,
  createGroupDraft,
  createGroupInvite,
  createInviteRelayEvent,
  declineGroupInvite,
  DomainInvariantError,
  leaveGroup,
  pauseGroup,
  reviewForwardedGroupInvite,
  updateGroupProfile
} from "@thenine/domain/group-formation";
import { assertNoRawCalendarContent } from "@thenine/domain/availability-mesh";
import type {
  AcceptGroupInviteResult,
  ApproveGroupPublicationResult,
  GroupProfilePatch,
  GroupInvitePreview,
  GroupDraft,
  GroupInvite,
  GroupResource,
  InviteDeclineResult,
  InviteRelayEvent,
  LeaveGroupResult,
  PauseGroupResult,
  UpdateGroupProfileResult
} from "@thenine/domain/group-formation";
import type { GroupFormat, VerificationStatus } from "@thenine/domain/group-eligibility";
import { ApiRouteError } from "./launchpad-route.js";
import type { ApiErrorCode } from "./launchpad-route.js";

export const POST_GROUP_ROUTE = {
  method: "POST",
  path: "/v1/groups",
  auth: "Member JWT",
  requiresIdempotencyKey: true
} as const;

export const GET_CURRENT_GROUPS_ROUTE = {
  method: "GET",
  path: "/v1/groups/current",
  auth: "Member JWT"
} as const;

export const GET_GROUP_ROUTE = {
  method: "GET",
  path: "/v1/groups/{groupId}",
  auth: "Group member"
} as const;

export const PATCH_GROUP_ROUTE = {
  method: "PATCH",
  path: "/v1/groups/{groupId}",
  auth: "Group member",
  requiresIdempotencyKey: true
} as const;

export const POST_GROUP_INVITE_ROUTE = {
  method: "POST",
  path: "/v1/groups/{groupId}/invites",
  auth: "Group member",
  requiresIdempotencyKey: true
} as const;

export const POST_GROUP_INVITE_RELAY_ROUTE = {
  method: "POST",
  path: "/v1/groups/{groupId}/invite-relay",
  auth: "Group member",
  requiresIdempotencyKey: true
} as const;

export const GET_GROUP_INVITE_ROUTE = {
  method: "GET",
  path: "/v1/group-invites/{token}",
  auth: "Optional member JWT"
} as const;

export const POST_GROUP_INVITE_ACCEPT_ROUTE = {
  method: "POST",
  path: "/v1/group-invites/{token}/accept",
  auth: "Member JWT",
  requiresIdempotencyKey: true
} as const;

export const POST_GROUP_INVITE_DECLINE_ROUTE = {
  method: "POST",
  path: "/v1/group-invites/{token}/decline",
  auth: "Member JWT",
  requiresIdempotencyKey: true
} as const;

export const POST_GROUP_INVITE_APPROVAL_ROUTE = {
  method: "POST",
  path: "/v1/group-invites/{token}/approval",
  auth: "Inviter",
  requiresIdempotencyKey: true
} as const;

export const POST_GROUP_PUBLISH_APPROVAL_ROUTE = {
  method: "POST",
  path: "/v1/groups/{groupId}/publish-approvals",
  auth: "Group member",
  requiresIdempotencyKey: true
} as const;

export const POST_GROUP_LEAVE_ROUTE = {
  method: "POST",
  path: "/v1/groups/{groupId}/leave",
  auth: "Group member",
  requiresIdempotencyKey: true
} as const;

export const POST_GROUP_PAUSE_ROUTE = {
  method: "POST",
  path: "/v1/groups/{groupId}/pause",
  auth: "Group member",
  requiresIdempotencyKey: true
} as const;

export interface GroupMutationMember {
  memberId: string;
  memberStatus: "active" | "suspended" | "banned" | "deleted";
  verificationStatus: VerificationStatus;
}

export interface GroupMutationContext {
  member: GroupMutationMember | null;
  idempotencyKey: string | null;
}

export interface CreateGroupBody {
  format: GroupFormat;
  cityId: string;
  name?: string;
  intent?: string;
}

export interface CreateGroupDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  nextGroupId: () => string;
  saveGroupDraft: (group: GroupDraft) => Promise<GroupDraft>;
}

export interface CurrentGroupsResult {
  groups: GroupResource[];
  activeGroupId: string | null;
}

export interface CurrentGroupsDependencies {
  loadCurrentGroupsForMember: (memberId: string) => Promise<{ groups: GroupDraft[]; activeGroupId: string | null }>;
}

export interface GetGroupDependencies {
  loadGroupForMember: (groupId: string, memberId: string) => Promise<GroupDraft>;
}

export type PatchGroupBody = GroupProfilePatch;

export interface PatchGroupDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadGroupForMember: (groupId: string, memberId: string) => Promise<GroupDraft>;
  computeVisibilityPreviewHash: (input: { group: GroupDraft; patch: PatchGroupBody }) => string;
  now: () => Date;
  saveGroupProfileUpdate: (result: UpdateGroupProfileResult) => Promise<UpdateGroupProfileResult>;
}

export interface CreateInviteBody {
  recipientHint?: string;
  expiresInHours: number;
}

export interface CreateInviteRelayBody extends CreateInviteBody {
  sourceChannel: InviteRelayEvent["sourceChannel"];
}

export interface CreateInviteDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadGroupForMember: (groupId: string, memberId: string) => Promise<GroupDraft>;
  nextInviteId: () => string;
  createInviteToken: () => { tokenHash: string; shareUrl: string };
  hashRecipientHint: (recipientHint: string) => string;
  now: () => Date;
  saveGroupInvite: (invite: GroupInvite) => Promise<GroupInvite>;
}

export interface CreateInviteRelayDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadGroupForMember: (groupId: string, memberId: string) => Promise<GroupDraft>;
  nextInviteId: () => string;
  nextRelayEventId: () => string;
  createInviteToken: () => { tokenHash: string; shareUrl: string };
  hashRecipientHint: (recipientHint: string) => string;
  now: () => Date;
  saveInviteRelay: (input: { invite: GroupInvite; relayEvent: InviteRelayEvent; shareUrl: string }) => Promise<{ invite: GroupInvite; relayEvent: InviteRelayEvent; shareUrl: string }>;
}

export interface AcceptInviteBody {
  consent: boolean;
}

export interface GetInvitePreviewContext {
  member: { memberId: string; verificationStatus: VerificationStatus } | null;
}

export interface GetInvitePreviewDependencies {
  hashInviteToken: (token: string) => string;
  loadInvitePreviewByTokenHash: (tokenHash: string) => Promise<{
    invite: GroupInvite;
    inviterFirstName: string;
    group: { id: string; format: GroupFormat; cityId: string; name: string | null };
  }>;
  now: () => Date;
}

export interface AcceptInviteDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  hashInviteToken: (token: string) => string;
  loadInviteByTokenHash: (tokenHash: string) => Promise<GroupInvite>;
  loadGroupById: (groupId: string) => Promise<GroupDraft>;
  now: () => Date;
  saveAcceptedInvite: (result: AcceptGroupInviteResult) => Promise<AcceptGroupInviteResult>;
}

export interface DeclineInviteBody {
  sourceChannel: InviteRelayEvent["sourceChannel"];
}

export interface DeclineInviteDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  hashInviteToken: (token: string) => string;
  loadInviteByTokenHash: (tokenHash: string) => Promise<GroupInvite>;
  nextRelayEventId: () => string;
  now: () => Date;
  saveInviteDecline: (input: InviteDeclineResult) => Promise<InviteDeclineResult>;
}

export interface InviteApprovalBody {
  approve: boolean;
}

export interface InviteApprovalDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  hashInviteToken: (token: string) => string;
  loadInviteForInviterApproval: (tokenHash: string, memberId: string) => Promise<GroupInvite>;
  nextRelayEventId: () => string;
  now: () => Date;
  saveInviteApprovalReview: (input: { invite: GroupInvite; relayEvent: InviteRelayEvent }) => Promise<{ invite: GroupInvite; relayEvent: InviteRelayEvent }>;
}

export interface LeaveGroupBody {
  reasonCode?: string;
  safetyExit?: boolean;
}

export interface PauseGroupBody {
  reasonCode?: string;
}

export interface LeaveGroupDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadGroupLeaveContext: (
    groupId: string,
    memberId: string
  ) => Promise<{ group: GroupDraft; affectedPlanIds: string[]; affectedConversationIds: string[] }>;
  now: () => Date;
  saveGroupLeave: (result: LeaveGroupResult) => Promise<LeaveGroupResult>;
}

export interface PauseGroupDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadGroupForMember: (groupId: string, memberId: string) => Promise<GroupDraft>;
  now: () => Date;
  saveGroupPause: (result: PauseGroupResult) => Promise<PauseGroupResult>;
}

export interface PublishApprovalBody {
  approve: boolean;
  visibilityPreviewHash: string;
}

export interface PublishApprovalDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadGroupPublishApprovalContext: (
    groupId: string,
    memberId: string
  ) => Promise<{ group: GroupDraft; currentVisibilityPreviewHash: string }>;
  now: () => Date;
  saveGroupPublishApproval: (result: ApproveGroupPublicationResult) => Promise<GroupDraft>;
}

export async function handlePostGroup(
  context: GroupMutationContext,
  body: CreateGroupBody,
  dependencies: CreateGroupDependencies
): Promise<GroupDraft> {
  const member = requireMember(context.member);
  await reserveRequiredIdempotency(POST_GROUP_ROUTE.method, POST_GROUP_ROUTE.path, context, dependencies.reserveIdempotencyKey);

  try {
    const group = createGroupDraft({
      groupId: dependencies.nextGroupId(),
      cityId: body.cityId,
      format: body.format,
      creator: member,
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.intent === undefined ? {} : { intent: body.intent })
    });

    return await dependencies.saveGroupDraft(group);
  } catch (error) {
    throw mapDomainError(error);
  }
}

export async function handleGetCurrentGroups(
  context: GroupMutationContext,
  dependencies: CurrentGroupsDependencies
): Promise<CurrentGroupsResult> {
  const member = requireMember(context.member);

  try {
    const currentGroups = await dependencies.loadCurrentGroupsForMember(member.memberId);

    return {
      activeGroupId: currentGroups.activeGroupId,
      groups: currentGroups.groups.map((group) => buildGroupResourceForMember({ group, viewerMemberId: member.memberId }))
    };
  } catch (error) {
    throw mapDomainError(error);
  }
}

export async function handleGetGroup(
  context: GroupMutationContext,
  params: { groupId: string },
  dependencies: GetGroupDependencies
): Promise<GroupResource> {
  const member = requireMember(context.member);

  try {
    const group = await dependencies.loadGroupForMember(params.groupId, member.memberId);

    return buildGroupResourceForMember({ group, viewerMemberId: member.memberId });
  } catch (error) {
    throw mapDomainError(error);
  }
}

export async function handlePatchGroup(
  context: GroupMutationContext,
  params: { groupId: string },
  body: PatchGroupBody & Record<string, unknown>,
  dependencies: PatchGroupDependencies
): Promise<GroupDraft> {
  const member = requireMember(context.member);
  await reserveRequiredIdempotency(PATCH_GROUP_ROUTE.method, PATCH_GROUP_ROUTE.path, context, dependencies.reserveIdempotencyKey);

  try {
    assertNoRawCalendarContent(body);
  } catch (error) {
    throw new ApiRouteError("VALIDATION_ERROR", error instanceof Error ? error.message : "Raw calendar event content is not allowed.");
  }

  try {
    const group = await dependencies.loadGroupForMember(params.groupId, member.memberId);
    const patch = toPatchGroupBody(body);
    const visibilityPreviewHash = dependencies.computeVisibilityPreviewHash({ group, patch });
    const result = updateGroupProfile({
      group,
      memberId: member.memberId,
      patch,
      visibilityPreviewHash,
      updatedAt: dependencies.now().toISOString()
    });
    const saved = await dependencies.saveGroupProfileUpdate(result);

    return saved.group;
  } catch (error) {
    throw mapDomainError(error);
  }
}

export async function handlePostGroupInvite(
  context: GroupMutationContext,
  params: { groupId: string },
  body: CreateInviteBody,
  dependencies: CreateInviteDependencies
): Promise<{ inviteId: string; shareUrl: string; expiresAt: string }> {
  const member = requireMember(context.member);
  await reserveRequiredIdempotency(
    POST_GROUP_INVITE_ROUTE.method,
    POST_GROUP_INVITE_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  try {
    const group = await dependencies.loadGroupForMember(params.groupId, member.memberId);
    const token = dependencies.createInviteToken();
    const expiresAt = new Date(dependencies.now().getTime() + body.expiresInHours * 60 * 60 * 1000).toISOString();
    const invite = createGroupInvite({
      inviteId: dependencies.nextInviteId(),
      group,
      inviterMemberId: member.memberId,
      tokenHash: token.tokenHash,
      ...(body.recipientHint === undefined ? {} : { recipientHintHash: dependencies.hashRecipientHint(body.recipientHint) }),
      expiresAt
    });

    const savedInvite = await dependencies.saveGroupInvite(invite);

    return {
      inviteId: savedInvite.id,
      shareUrl: token.shareUrl,
      expiresAt: savedInvite.expiresAt
    };
  } catch (error) {
    throw mapDomainError(error);
  }
}

export async function handlePostGroupInviteRelay(
  context: GroupMutationContext,
  params: { groupId: string },
  body: CreateInviteRelayBody,
  dependencies: CreateInviteRelayDependencies
): Promise<{ invite: GroupInvite; relayEvent: InviteRelayEvent; shareUrl: string }> {
  const member = requireMember(context.member);
  await reserveRequiredIdempotency(
    POST_GROUP_INVITE_RELAY_ROUTE.method,
    POST_GROUP_INVITE_RELAY_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  try {
    const group = await dependencies.loadGroupForMember(params.groupId, member.memberId);
    const token = dependencies.createInviteToken();
    const expiresAt = new Date(dependencies.now().getTime() + body.expiresInHours * 60 * 60 * 1000).toISOString();
    const invite = createGroupInvite({
      inviteId: dependencies.nextInviteId(),
      group,
      inviterMemberId: member.memberId,
      tokenHash: token.tokenHash,
      ...(body.recipientHint === undefined ? {} : { recipientHintHash: dependencies.hashRecipientHint(body.recipientHint) }),
      expiresAt
    });
    const relayEvent = createInviteRelayEvent({
      eventId: dependencies.nextRelayEventId(),
      invite,
      eventType: "created",
      sourceChannel: body.sourceChannel,
      occurredAt: dependencies.now().toISOString()
    });

    return await dependencies.saveInviteRelay({ invite, relayEvent, shareUrl: token.shareUrl });
  } catch (error) {
    throw mapDomainError(error);
  }
}

export async function handleGetGroupInvitePreview(
  context: GetInvitePreviewContext,
  params: { token: string },
  dependencies: GetInvitePreviewDependencies
): Promise<GroupInvitePreview> {
  try {
    const tokenHash = dependencies.hashInviteToken(params.token);
    const previewContext = await dependencies.loadInvitePreviewByTokenHash(tokenHash);

    return buildGroupInvitePreview({
      invite: previewContext.invite,
      inviterFirstName: previewContext.inviterFirstName,
      group: previewContext.group,
      viewerVerificationStatus: context.member?.verificationStatus ?? null,
      viewedAt: dependencies.now().toISOString()
    });
  } catch (error) {
    throw mapDomainError(error);
  }
}

export async function handleAcceptGroupInvite(
  context: GroupMutationContext,
  params: { token: string },
  body: AcceptInviteBody,
  dependencies: AcceptInviteDependencies
): Promise<AcceptGroupInviteResult> {
  const member = requireMember(context.member);
  await reserveRequiredIdempotency(
    POST_GROUP_INVITE_ACCEPT_ROUTE.method,
    POST_GROUP_INVITE_ACCEPT_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  if (body.consent !== true) {
    throw new ApiRouteError("VALIDATION_ERROR", "Invite acceptance requires explicit consent.");
  }

  try {
    const tokenHash = dependencies.hashInviteToken(params.token);
    const invite = await dependencies.loadInviteByTokenHash(tokenHash);
    const group = await dependencies.loadGroupById(invite.groupId);
    const result = acceptGroupInvite({
      group,
      invite,
      invitee: member,
      acceptedAt: dependencies.now().toISOString()
    });

    return await dependencies.saveAcceptedInvite(result);
  } catch (error) {
    throw mapDomainError(error);
  }
}

export async function handleDeclineGroupInvite(
  context: GroupMutationContext,
  params: { token: string },
  body: DeclineInviteBody,
  dependencies: DeclineInviteDependencies
): Promise<InviteDeclineResult> {
  requireMember(context.member);
  await reserveRequiredIdempotency(
    POST_GROUP_INVITE_DECLINE_ROUTE.method,
    POST_GROUP_INVITE_DECLINE_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  try {
    const tokenHash = dependencies.hashInviteToken(params.token);
    const invite = await dependencies.loadInviteByTokenHash(tokenHash);
    const result = declineGroupInvite({
      eventId: dependencies.nextRelayEventId(),
      invite,
      sourceChannel: body.sourceChannel,
      declinedAt: dependencies.now().toISOString()
    });

    return await dependencies.saveInviteDecline(result);
  } catch (error) {
    throw mapDomainError(error);
  }
}

export async function handlePostGroupInviteApproval(
  context: GroupMutationContext,
  params: { token: string },
  body: InviteApprovalBody,
  dependencies: InviteApprovalDependencies
): Promise<{ invite: GroupInvite; relayEvent: InviteRelayEvent }> {
  const member = requireMember(context.member);
  await reserveRequiredIdempotency(
    POST_GROUP_INVITE_APPROVAL_ROUTE.method,
    POST_GROUP_INVITE_APPROVAL_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  try {
    const tokenHash = dependencies.hashInviteToken(params.token);
    const invite = await dependencies.loadInviteForInviterApproval(tokenHash, member.memberId);
    const result = reviewForwardedGroupInvite({
      eventId: dependencies.nextRelayEventId(),
      invite,
      approved: body.approve,
      reviewedAt: dependencies.now().toISOString()
    });

    return await dependencies.saveInviteApprovalReview(result);
  } catch (error) {
    throw mapDomainError(error);
  }
}

export async function handlePostGroupPublishApproval(
  context: GroupMutationContext,
  params: { groupId: string },
  body: PublishApprovalBody,
  dependencies: PublishApprovalDependencies
): Promise<GroupDraft> {
  const member = requireMember(context.member);
  await reserveRequiredIdempotency(
    POST_GROUP_PUBLISH_APPROVAL_ROUTE.method,
    POST_GROUP_PUBLISH_APPROVAL_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  try {
    const approvalContext = await dependencies.loadGroupPublishApprovalContext(params.groupId, member.memberId);
    const result = approveGroupPublication({
      group: approvalContext.group,
      memberId: member.memberId,
      approve: body.approve,
      visibilityPreviewHash: body.visibilityPreviewHash,
      currentVisibilityPreviewHash: approvalContext.currentVisibilityPreviewHash,
      approvedAt: dependencies.now().toISOString()
    });

    return await dependencies.saveGroupPublishApproval(result);
  } catch (error) {
    throw mapDomainError(error);
  }
}

export async function handlePostGroupLeave(
  context: GroupMutationContext,
  params: { groupId: string },
  body: LeaveGroupBody,
  dependencies: LeaveGroupDependencies
): Promise<{ group: GroupDraft; affectedPlanIds: string[]; affectedConversationIds: string[] }> {
  const member = requireMember(context.member);
  await reserveRequiredIdempotency(
    POST_GROUP_LEAVE_ROUTE.method,
    POST_GROUP_LEAVE_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  try {
    const leaveContext = await dependencies.loadGroupLeaveContext(params.groupId, member.memberId);
    const result = leaveGroup({
      group: leaveContext.group,
      memberId: member.memberId,
      leftAt: dependencies.now().toISOString(),
      ...(body.reasonCode === undefined ? {} : { reasonCode: body.reasonCode }),
      ...(body.safetyExit === undefined ? {} : { safetyExit: body.safetyExit }),
      affectedPlanIds: leaveContext.affectedPlanIds,
      affectedConversationIds: leaveContext.affectedConversationIds
    });
    const saved = await dependencies.saveGroupLeave(result);

    return {
      group: saved.group,
      affectedPlanIds: saved.affectedPlanIds,
      affectedConversationIds: saved.affectedConversationIds
    };
  } catch (error) {
    throw mapDomainError(error);
  }
}

export async function handlePostGroupPause(
  context: GroupMutationContext,
  params: { groupId: string },
  body: PauseGroupBody,
  dependencies: PauseGroupDependencies
): Promise<GroupDraft> {
  const member = requireMember(context.member);
  await reserveRequiredIdempotency(
    POST_GROUP_PAUSE_ROUTE.method,
    POST_GROUP_PAUSE_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  try {
    const group = await dependencies.loadGroupForMember(params.groupId, member.memberId);
    const result = pauseGroup({
      group,
      memberId: member.memberId,
      pausedAt: dependencies.now().toISOString(),
      ...(body.reasonCode === undefined ? {} : { reasonCode: body.reasonCode })
    });
    const saved = await dependencies.saveGroupPause(result);

    return saved.group;
  } catch (error) {
    throw mapDomainError(error);
  }
}

function requireMember(member: GroupMutationMember | null): GroupMutationMember {
  if (member === null) {
    throw new ApiRouteError("UNAUTHENTICATED", "Route requires a member session.");
  }

  return member;
}

async function reserveRequiredIdempotency(
  method: string,
  path: string,
  context: GroupMutationContext,
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>
): Promise<void> {
  if (context.idempotencyKey === null || context.idempotencyKey.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Mutating routes require Idempotency-Key.");
  }

  const member = requireMember(context.member);
  await reserveIdempotencyKey(`${method} ${path}`, context.idempotencyKey, member.memberId);
}

function mapDomainError(error: unknown): Error {
  if (error instanceof DomainInvariantError) {
    return new ApiRouteError(error.code as ApiErrorCode, error.message);
  }

  return error instanceof Error ? error : new ApiRouteError("UNPROCESSABLE_STATE", "Unexpected route failure.");
}

function toPatchGroupBody(body: PatchGroupBody): PatchGroupBody {
  return {
    ...(body.name === undefined ? {} : { name: body.name }),
    ...(body.intent === undefined ? {} : { intent: body.intent }),
    ...(body.neighborhoodIds === undefined ? {} : { neighborhoodIds: body.neighborhoodIds }),
    ...(body.availabilityWindows === undefined ? {} : { availabilityWindows: body.availabilityWindows })
  };
}
