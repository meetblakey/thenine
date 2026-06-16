import {
  buildAttendanceConfirmation,
  acceptPlanFastTrackProposal,
  buildPlanFastTrackProposal,
  buildPlanConfirmation,
  buildPlanPoll,
  buildPlanRsvpChange,
  buildTrustedContactPlanShare
} from "@thenine/domain";
import { DomainInvariantError } from "@thenine/domain/group-eligibility";
import type {
  AttendanceConfirmationResult,
  AttendanceStatus,
  ConversationStatus,
  PlanFastTrackAcceptResult,
  PlanFastTrackProposal,
  PlanFastTrackProposalResult,
  PlanFastTrackVenueCandidate,
  PlanFastTrackAvailabilityWindow,
  PlanConfirmationResult,
  PlanFormat,
  PlanPollResult,
  PlanResource,
  PlanRsvpChangeResult,
  PlanRsvpStatus,
  TrustedContactPlanShareResult
} from "@thenine/domain";
import { ApiRouteError } from "./launchpad-route.js";
import type { ApiErrorCode } from "./launchpad-route.js";

export const POST_CONVERSATION_PLAN_ROUTE = {
  method: "POST",
  path: "/v1/conversations/{conversationId}/plans",
  auth: "Conversation participant",
  requiresIdempotencyKey: true
} as const;

export const POST_CONVERSATION_PLAN_FAST_TRACK_ROUTE = {
  method: "POST",
  path: "/v1/conversations/{conversationId}/plan-fast-track",
  auth: "Conversation participant",
  requiresIdempotencyKey: true
} as const;

export const POST_PLAN_PROPOSAL_ACCEPT_ROUTE = {
  method: "POST",
  path: "/v1/plan-proposals/{proposalId}/accept",
  auth: "Conversation participant",
  requiresIdempotencyKey: true
} as const;

export const POST_PLAN_RSVP_ROUTE = {
  method: "POST",
  path: "/v1/plans/{planId}/rsvps",
  auth: "Plan participant",
  requiresIdempotencyKey: true
} as const;

export const POST_PLAN_CONFIRM_ROUTE = {
  method: "POST",
  path: "/v1/plans/{planId}/confirm",
  auth: "Plan participant",
  requiresIdempotencyKey: true
} as const;

export const POST_PLAN_SHARE_ROUTE = {
  method: "POST",
  path: "/v1/plans/{planId}/share",
  auth: "Plan participant",
  requiresIdempotencyKey: true
} as const;

export const POST_PLAN_ATTENDANCE_ROUTE = {
  method: "POST",
  path: "/v1/plans/{planId}/attendance",
  auth: "Plan participant",
  requiresIdempotencyKey: true
} as const;

export interface PlanMutationMember {
  memberId: string;
}

export interface PlanMutationContext {
  member: PlanMutationMember | null;
  idempotencyKey: string | null;
}

export interface ConversationPlanAccess {
  conversationStatus: "active" | "write_limited" | "expired" | "closed";
  groupIds: string[];
  cityId: string;
}

export interface ConversationPlanBody {
  format: PlanFormat;
  timeOptions: Array<{ startsAt: string; endsAt: string }>;
  venueOptions?: Array<{ venueId?: string; manualLabel?: string }>;
}

export interface ConversationPlanDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadConversationPlanAccess: (conversationId: string, memberId: string) => Promise<ConversationPlanAccess>;
  assertGroupsEligibleForPlan: (groupIds: string[]) => Promise<void>;
  nextPlanId: () => string;
  nextPlanOptionIds: (count: number) => string[];
  now: () => Date;
  persistPlanPoll: (input: PlanPollResult) => Promise<PlanResource>;
}

export interface ConversationPlanFastTrackBody {
  sourceGroupId: string;
  format: PlanFormat;
}

export interface ConversationPlanFastTrackDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadPlanFastTrackAccess: (
    conversationId: string,
    memberId: string
  ) => Promise<{
    conversationStatus: ConversationStatus;
    groupIds: string[];
    availabilityWindows: PlanFastTrackAvailabilityWindow[];
    venueCandidates: PlanFastTrackVenueCandidate[];
  }>;
  nextProposalId: () => string;
  nextTimeOptionIds: (count: number) => string[];
  nextVenueOptionIds: (count: number) => string[];
  now: () => Date;
  persistPlanFastTrackProposal: (input: PlanFastTrackProposalResult) => Promise<PlanFastTrackProposal>;
}

export interface PlanProposalAcceptBody {
  selectedTimeOptionId: string;
  selectedVenueOptionId: string;
  rsvpDeadlineAt: string;
}

export interface PlanProposalAcceptDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadPlanFastTrackProposalAccess: (proposalId: string, memberId: string) => Promise<PlanFastTrackProposal>;
  nextPlanId: () => string;
  now: () => Date;
  persistAcceptedPlanFastTrack: (input: PlanFastTrackAcceptResult) => Promise<PlanResource>;
}

export interface PlanRsvpBody {
  status: PlanRsvpStatus;
  reasonCode?: string;
}

export interface PlanRsvpDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadPlanRsvpAccess: (planId: string, memberId: string) => Promise<{ plan: PlanResource; groupId: string; requiredMemberIds: string[] }>;
  now: () => Date;
  persistPlanRsvp: (input: PlanRsvpChangeResult) => Promise<PlanResource>;
}

export interface PlanConfirmBody {
  selectedOptionId?: string;
}

export interface PlanConfirmationDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadPlanConfirmationAccess: (planId: string, memberId: string) => Promise<{ plan: PlanResource; requiredMemberIds: string[] }>;
  now: () => Date;
  persistPlanConfirmation: (input: PlanConfirmationResult) => Promise<PlanResource>;
}

export interface PlanShareBody {
  contactLabel: string;
  contactChannel: string;
}

export interface PlanShareDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadPlanShareAccess: (planId: string, memberId: string) => Promise<{ plan: PlanResource }>;
  nextShareId: () => string;
  hashContactChannel: (contactChannel: string) => string;
  now: () => Date;
  persistTrustedContactPlanShare: (input: TrustedContactPlanShareResult) => Promise<{ id: string; deliveryStatus: "queued" | "sent" }>;
}

export interface PlanAttendanceBody {
  status: AttendanceStatus;
  reasonCode?: string;
}

export interface PlanAttendanceDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadAttendanceAccess: (planId: string, memberId: string) => Promise<{ plan: PlanResource; groupId: string }>;
  nextAttendanceId: () => string;
  now: () => Date;
  persistAttendanceConfirmation: (input: AttendanceConfirmationResult) => Promise<{ attendanceId: string; planId: string; status: string }>;
}

export async function handlePostConversationPlan(
  context: PlanMutationContext,
  params: { conversationId: string },
  body: ConversationPlanBody,
  dependencies: ConversationPlanDependencies
): Promise<PlanResource> {
  const member = requirePlanMember(context.member);
  await reserveRequiredPlanIdempotency(
    POST_CONVERSATION_PLAN_ROUTE.method,
    POST_CONVERSATION_PLAN_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  const access = await dependencies.loadConversationPlanAccess(params.conversationId, member.memberId);
  await dependencies.assertGroupsEligibleForPlan(access.groupIds);

  const venueOptions = body.venueOptions ?? [];
  const optionIds = dependencies.nextPlanOptionIds(body.timeOptions.length + venueOptions.length);

  if (optionIds.length !== body.timeOptions.length + venueOptions.length) {
    throw new ApiRouteError("UNPROCESSABLE_STATE", "Plan option id generator returned an unexpected count.");
  }

  try {
    const planPoll = buildPlanPoll({
      planId: dependencies.nextPlanId(),
      conversationId: params.conversationId,
      cityId: access.cityId,
      format: body.format,
      createdByMemberId: member.memberId,
      conversation: {
        status: access.conversationStatus,
        groupIds: access.groupIds
      },
      timeOptions: body.timeOptions.map((option, index) => ({
        id: optionIds[index] ?? "",
        startsAt: option.startsAt,
        endsAt: option.endsAt
      })),
      venueOptions: venueOptions.map((option, index) => {
        const id = optionIds[body.timeOptions.length + index] ?? "";

        return {
          id,
          ...(option.venueId === undefined ? {} : { venueId: option.venueId }),
          ...(option.manualLabel === undefined ? {} : { manualLabel: option.manualLabel })
        };
      }),
      createdAt: dependencies.now().toISOString()
    });

    return await dependencies.persistPlanPoll(planPoll);
  } catch (error) {
    throw mapPlanDomainError(error);
  }
}

export async function handlePostConversationPlanFastTrack(
  context: PlanMutationContext,
  params: { conversationId: string },
  body: ConversationPlanFastTrackBody,
  dependencies: ConversationPlanFastTrackDependencies
): Promise<PlanFastTrackProposal> {
  const member = requirePlanMember(context.member);
  await reserveRequiredPlanIdempotency(
    POST_CONVERSATION_PLAN_FAST_TRACK_ROUTE.method,
    POST_CONVERSATION_PLAN_FAST_TRACK_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  const access = await dependencies.loadPlanFastTrackAccess(params.conversationId, member.memberId);

  try {
    const proposal = buildPlanFastTrackProposal({
      proposalId: dependencies.nextProposalId(),
      conversationId: params.conversationId,
      createdByMemberId: member.memberId,
      sourceGroupId: body.sourceGroupId,
      format: body.format,
      conversation: {
        status: access.conversationStatus,
        groupIds: access.groupIds
      },
      availabilityWindows: access.availabilityWindows,
      venueCandidates: access.venueCandidates,
      timeOptionIds: dependencies.nextTimeOptionIds(1),
      venueOptionIds: dependencies.nextVenueOptionIds(access.venueCandidates.length),
      createdAt: dependencies.now().toISOString()
    });

    return await dependencies.persistPlanFastTrackProposal(proposal);
  } catch (error) {
    throw mapPlanDomainError(error);
  }
}

export async function handlePostPlanProposalAccept(
  context: PlanMutationContext,
  params: { proposalId: string },
  body: PlanProposalAcceptBody,
  dependencies: PlanProposalAcceptDependencies
): Promise<PlanResource> {
  const member = requirePlanMember(context.member);
  await reserveRequiredPlanIdempotency(
    POST_PLAN_PROPOSAL_ACCEPT_ROUTE.method,
    POST_PLAN_PROPOSAL_ACCEPT_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  const proposal = await dependencies.loadPlanFastTrackProposalAccess(params.proposalId, member.memberId);

  try {
    const accepted = acceptPlanFastTrackProposal({
      proposal,
      planId: dependencies.nextPlanId(),
      selectedTimeOptionId: body.selectedTimeOptionId,
      selectedVenueOptionId: body.selectedVenueOptionId,
      rsvpDeadlineAt: body.rsvpDeadlineAt,
      acceptedAt: dependencies.now().toISOString()
    });

    return await dependencies.persistAcceptedPlanFastTrack(accepted);
  } catch (error) {
    throw mapPlanDomainError(error);
  }
}

export async function handlePostPlanRsvp(
  context: PlanMutationContext,
  params: { planId: string },
  body: PlanRsvpBody,
  dependencies: PlanRsvpDependencies
): Promise<PlanResource> {
  const member = requirePlanMember(context.member);
  await reserveRequiredPlanIdempotency(
    POST_PLAN_RSVP_ROUTE.method,
    POST_PLAN_RSVP_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  const access = await dependencies.loadPlanRsvpAccess(params.planId, member.memberId);

  try {
    const rsvpChange = buildPlanRsvpChange({
      plan: access.plan,
      memberId: member.memberId,
      groupId: access.groupId,
      status: body.status,
      ...(body.reasonCode === undefined ? {} : { reasonCode: body.reasonCode }),
      requiredMemberIds: access.requiredMemberIds,
      respondedAt: dependencies.now().toISOString()
    });

    return await dependencies.persistPlanRsvp(rsvpChange);
  } catch (error) {
    throw mapPlanDomainError(error);
  }
}

export async function handlePostPlanConfirm(
  context: PlanMutationContext,
  params: { planId: string },
  _body: PlanConfirmBody,
  dependencies: PlanConfirmationDependencies
): Promise<PlanResource> {
  const member = requirePlanMember(context.member);
  await reserveRequiredPlanIdempotency(
    POST_PLAN_CONFIRM_ROUTE.method,
    POST_PLAN_CONFIRM_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  const access = await dependencies.loadPlanConfirmationAccess(params.planId, member.memberId);

  try {
    const confirmation = buildPlanConfirmation({
      plan: access.plan,
      requiredMemberIds: access.requiredMemberIds,
      confirmedAt: dependencies.now().toISOString()
    });

    return await dependencies.persistPlanConfirmation(confirmation);
  } catch (error) {
    throw mapPlanDomainError(error);
  }
}

export async function handlePostPlanShare(
  context: PlanMutationContext,
  params: { planId: string },
  body: PlanShareBody,
  dependencies: PlanShareDependencies
): Promise<{ shareId: string; deliveryStatus: "queued" | "sent" }> {
  const member = requirePlanMember(context.member);
  await reserveRequiredPlanIdempotency(
    POST_PLAN_SHARE_ROUTE.method,
    POST_PLAN_SHARE_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  if (body.contactLabel.trim() === "" || body.contactChannel.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Plan sharing requires contact label and contact channel.");
  }

  const access = await dependencies.loadPlanShareAccess(params.planId, member.memberId);
  const contactChannelHash = dependencies.hashContactChannel(body.contactChannel);

  try {
    const planShare = buildTrustedContactPlanShare({
      shareId: dependencies.nextShareId(),
      plan: access.plan,
      memberId: member.memberId,
      contactLabel: body.contactLabel,
      contactChannelHash,
      sharedAt: dependencies.now().toISOString()
    });
    const persistedShare = await dependencies.persistTrustedContactPlanShare(planShare);

    return {
      shareId: persistedShare.id,
      deliveryStatus: persistedShare.deliveryStatus
    };
  } catch (error) {
    throw mapPlanDomainError(error);
  }
}

export async function handlePostPlanAttendance(
  context: PlanMutationContext,
  params: { planId: string },
  body: PlanAttendanceBody,
  dependencies: PlanAttendanceDependencies
): Promise<{ attendanceId: string; planId: string; status: string }> {
  const member = requirePlanMember(context.member);
  await reserveRequiredPlanIdempotency(
    POST_PLAN_ATTENDANCE_ROUTE.method,
    POST_PLAN_ATTENDANCE_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  const access = await dependencies.loadAttendanceAccess(params.planId, member.memberId);

  try {
    const attendance = buildAttendanceConfirmation({
      attendanceId: dependencies.nextAttendanceId(),
      plan: access.plan,
      memberId: member.memberId,
      groupId: access.groupId,
      status: body.status,
      ...(body.reasonCode === undefined ? {} : { reasonCode: body.reasonCode }),
      createdAt: dependencies.now().toISOString()
    });

    return await dependencies.persistAttendanceConfirmation(attendance);
  } catch (error) {
    throw mapPlanDomainError(error);
  }
}

function requirePlanMember(member: PlanMutationMember | null): PlanMutationMember {
  if (member === null) {
    throw new ApiRouteError("UNAUTHENTICATED", "Plan routes require a member session.");
  }

  return member;
}

async function reserveRequiredPlanIdempotency(
  method: string,
  path: string,
  context: PlanMutationContext,
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>
): Promise<void> {
  if (context.idempotencyKey === null || context.idempotencyKey.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Mutating routes require Idempotency-Key.");
  }

  const member = requirePlanMember(context.member);
  await reserveIdempotencyKey(`${method} ${path}`, context.idempotencyKey, member.memberId);
}

function mapPlanDomainError(error: unknown): Error {
  if (error instanceof DomainInvariantError) {
    return new ApiRouteError(error.code as ApiErrorCode, error.message);
  }

  return error instanceof Error ? error : new ApiRouteError("UNPROCESSABLE_STATE", "Unexpected Plan route failure.");
}
