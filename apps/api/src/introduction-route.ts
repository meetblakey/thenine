import { buildMatchedGroupConversation, serializeIntroductionForClient } from "@thenine/domain";
import { assertIntroductionRecipient, DomainInvariantError } from "@thenine/domain/group-eligibility";
import type { GroupEligibilityResult } from "@thenine/domain/group-eligibility";
import type { ClientIntroductionResource, GroupFormat, IntroductionRecord, MatchedGroupConversationResult } from "@thenine/domain";
import { ApiRouteError } from "./launchpad-route.js";
import type { ApiErrorCode } from "./launchpad-route.js";

export const GET_DAILY_INTRODUCTIONS_ROUTE = {
  method: "GET",
  path: "/v1/groups/{groupId}/introductions/daily",
  auth: "Group member"
} as const;

export const GET_INTRODUCTION_ROUTE = {
  method: "GET",
  path: "/v1/groups/{groupId}/introductions/{introductionId}",
  auth: "Group member"
} as const;

export const POST_INTRODUCTION_INTEREST_ROUTE = {
  method: "POST",
  path: "/v1/groups/{groupId}/introductions/{introductionId}/interest",
  auth: "Group member",
  requiresIdempotencyKey: true
} as const;

export const POST_INTRODUCTION_APPROVAL_ROUTE = {
  method: "POST",
  path: "/v1/groups/{groupId}/introductions/{introductionId}/interest-approvals",
  auth: "Group member",
  requiresIdempotencyKey: true
} as const;

export const POST_INTRODUCTION_PASS_ROUTE = {
  method: "POST",
  path: "/v1/groups/{groupId}/introductions/{introductionId}/pass",
  auth: "Group member",
  requiresIdempotencyKey: true
} as const;

export interface IntroductionMember {
  memberId: string;
}

export interface IntroductionContext {
  member: IntroductionMember | null;
}

export interface IntroductionMutationContext extends IntroductionContext {
  idempotencyKey: string | null;
}

export interface DailyIntroductionsQuery {
  date?: string;
  format?: GroupFormat;
  memberId?: string;
}

export interface DailyIntroductionSet {
  setId: string;
  baselineSize: number;
  entitlementExtraSize: number;
  liquidityMode: string;
  introductions: IntroductionRecord[];
}

export interface DailyIntroductionsResponse {
  setId: string;
  baselineSize: number;
  entitlementExtraSize: number;
  liquidityMode: string;
  introductions: ClientIntroductionResource[];
}

export interface IntroductionRouteDependencies {
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  loadGroupEligibility: (groupId: string) => Promise<GroupEligibilityResult>;
  loadDailyIntroductionSet: (input: {
    recipientGroupId: string;
    date?: string;
    format?: GroupFormat;
  }) => Promise<DailyIntroductionSet>;
}

export interface IntroductionDetailDependencies {
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  loadIntroductionForGroup: (input: { groupId: string; introductionId: string }) => Promise<IntroductionRecord>;
}

export type IntroductionApprovalState = "pending_internal" | "sent" | "matched" | "declined";

export interface PostIntroductionInterestBody {
  clientNonce: string;
}

export interface IntroductionInterestDecision {
  introduction: IntroductionRecord;
  approvalState: IntroductionApprovalState;
  sourceGroupId: string;
  targetGroupId: string | null;
}

export interface IntroductionInterestDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  loadGroupEligibility: (groupId: string) => Promise<GroupEligibilityResult>;
  recordGroupInterest: (input: {
    groupId: string;
    introductionId: string;
    memberId: string;
    clientNonce: string;
  }) => Promise<IntroductionInterestDecision>;
  nextConversationId: () => string;
  loadConversationParticipantGroups: (
    groupIds: string[]
  ) => Promise<Array<{ groupId: string; memberIds: string[] }>>;
  persistMatchedGroupConversation: (input: MatchedGroupConversationResult) => Promise<void>;
}

export interface IntroductionApprovalDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  loadGroupEligibility: (groupId: string) => Promise<GroupEligibilityResult>;
  reviewIntroductionInterestApproval: (input: {
    groupId: string;
    introductionId: string;
    memberId: string;
    approve: boolean;
  }) => Promise<IntroductionInterestDecision>;
  nextConversationId: () => string;
  loadConversationParticipantGroups: (
    groupIds: string[]
  ) => Promise<Array<{ groupId: string; memberIds: string[] }>>;
  persistMatchedGroupConversation: (input: MatchedGroupConversationResult) => Promise<void>;
}

export interface IntroductionPassDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  recordIntroductionPass: (input: { groupId: string; introductionId: string; memberId: string; reasonCode?: string }) => Promise<{
    introductionId: string;
    status: "passed";
  }>;
}

export interface PostIntroductionInterestResponse {
  introduction: ClientIntroductionResource;
  approvalState: IntroductionApprovalState;
}

export interface PostIntroductionPassBody {
  reasonCode?: string;
}

export async function handleGetDailyIntroductions(
  context: IntroductionContext,
  params: { groupId: string },
  query: DailyIntroductionsQuery,
  dependencies: IntroductionRouteDependencies
): Promise<DailyIntroductionsResponse> {
  if (context.member === null) {
    throw new ApiRouteError("UNAUTHENTICATED", "Daily Introductions require a member session.");
  }

  if (query.memberId !== undefined) {
    throw new ApiRouteError("VALIDATION_ERROR", "Dating inventory routes must not accept memberId.");
  }

  await dependencies.assertGroupMemberAccess(params.groupId, context.member.memberId);
  const eligibility = await dependencies.loadGroupEligibility(params.groupId);

  try {
    assertIntroductionRecipient({
      recipientGroupId: params.groupId,
      eligibility
    });
  } catch (error) {
    throw mapIntroductionDomainError(error);
  }

  const set = await dependencies.loadDailyIntroductionSet({
    recipientGroupId: params.groupId,
    ...(query.date === undefined ? {} : { date: query.date }),
    ...(query.format === undefined ? {} : { format: query.format })
  });

  return {
    setId: set.setId,
    baselineSize: set.baselineSize,
    entitlementExtraSize: set.entitlementExtraSize,
    liquidityMode: set.liquidityMode,
    introductions: set.introductions.map((introduction) => serializeIntroductionForClient(introduction))
  };
}

export async function handleGetIntroduction(
  context: IntroductionContext,
  params: { groupId: string; introductionId: string },
  dependencies: IntroductionDetailDependencies
): Promise<ClientIntroductionResource> {
  const member = requireIntroductionMember(context.member);
  await dependencies.assertGroupMemberAccess(params.groupId, member.memberId);
  const introduction = await dependencies.loadIntroductionForGroup({
    groupId: params.groupId,
    introductionId: params.introductionId
  });

  assertIntroductionBelongsToGroup(introduction, params.groupId, params.introductionId);

  return serializeIntroductionForClient(introduction);
}

export async function handlePostIntroductionInterest(
  context: IntroductionMutationContext,
  params: { groupId: string; introductionId: string },
  body: PostIntroductionInterestBody,
  dependencies: IntroductionInterestDependencies
): Promise<PostIntroductionInterestResponse> {
  const member = requireIntroductionMember(context.member);
  await reserveRequiredIntroductionIdempotency(
    POST_INTRODUCTION_INTEREST_ROUTE.method,
    POST_INTRODUCTION_INTEREST_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  if (body.clientNonce.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Introduction interest requires clientNonce.");
  }

  await dependencies.assertGroupMemberAccess(params.groupId, member.memberId);
  const eligibility = await dependencies.loadGroupEligibility(params.groupId);

  try {
    assertIntroductionRecipient({
      recipientGroupId: params.groupId,
      eligibility
    });
  } catch (error) {
    throw mapIntroductionDomainError(error);
  }

  const decision = await dependencies.recordGroupInterest({
    groupId: params.groupId,
    introductionId: params.introductionId,
    memberId: member.memberId,
    clientNonce: body.clientNonce
  });

  if (decision.introduction.id !== params.introductionId || decision.introduction.recipientGroupId !== params.groupId) {
    throw new ApiRouteError("UNPROCESSABLE_STATE", "Interest decision does not match the requested group Introduction.");
  }

  await persistMatchedConversationWhenNeeded(decision, dependencies);

  return {
    introduction: serializeIntroductionForClient(decision.introduction),
    approvalState: decision.approvalState
  };
}

export async function handlePostIntroductionApproval(
  context: IntroductionMutationContext,
  params: { groupId: string; introductionId: string },
  body: { approve: boolean },
  dependencies: IntroductionApprovalDependencies
): Promise<PostIntroductionInterestResponse> {
  const member = requireIntroductionMember(context.member);
  await reserveRequiredIntroductionIdempotency(
    POST_INTRODUCTION_APPROVAL_ROUTE.method,
    POST_INTRODUCTION_APPROVAL_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );
  await dependencies.assertGroupMemberAccess(params.groupId, member.memberId);
  const eligibility = await dependencies.loadGroupEligibility(params.groupId);

  try {
    assertIntroductionRecipient({
      recipientGroupId: params.groupId,
      eligibility
    });
  } catch (error) {
    throw mapIntroductionDomainError(error);
  }

  const decision = await dependencies.reviewIntroductionInterestApproval({
    groupId: params.groupId,
    introductionId: params.introductionId,
    memberId: member.memberId,
    approve: body.approve
  });

  assertIntroductionBelongsToGroup(decision.introduction, params.groupId, params.introductionId);
  await persistMatchedConversationWhenNeeded(decision, dependencies);

  return {
    introduction: serializeIntroductionForClient(decision.introduction),
    approvalState: decision.approvalState
  };
}

export async function handlePostIntroductionPass(
  context: IntroductionMutationContext,
  params: { groupId: string; introductionId: string },
  body: PostIntroductionPassBody,
  dependencies: IntroductionPassDependencies
): Promise<{ introductionId: string; status: "passed" }> {
  const member = requireIntroductionMember(context.member);
  await reserveRequiredIntroductionIdempotency(
    POST_INTRODUCTION_PASS_ROUTE.method,
    POST_INTRODUCTION_PASS_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );
  await dependencies.assertGroupMemberAccess(params.groupId, member.memberId);

  if (body.reasonCode !== undefined && body.reasonCode.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Introduction pass reasonCode cannot be blank.");
  }

  return dependencies.recordIntroductionPass({
    groupId: params.groupId,
    introductionId: params.introductionId,
    memberId: member.memberId,
    ...(body.reasonCode === undefined ? {} : { reasonCode: body.reasonCode })
  });
}

function requireIntroductionMember(member: IntroductionMember | null): IntroductionMember {
  if (member === null) {
    throw new ApiRouteError("UNAUTHENTICATED", "Introduction routes require a member session.");
  }

  return member;
}

async function reserveRequiredIntroductionIdempotency(
  method: string,
  path: string,
  context: IntroductionMutationContext,
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>
): Promise<void> {
  if (context.idempotencyKey === null || context.idempotencyKey.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Mutating routes require Idempotency-Key.");
  }

  const member = requireIntroductionMember(context.member);
  await reserveIdempotencyKey(`${method} ${path}`, context.idempotencyKey, member.memberId);
}

function mapIntroductionDomainError(error: unknown): Error {
  if (error instanceof DomainInvariantError) {
    return new ApiRouteError(error.code as ApiErrorCode, error.message);
  }

  return error instanceof Error ? error : new ApiRouteError("UNPROCESSABLE_STATE", "Unexpected Introduction route failure.");
}

function assertIntroductionBelongsToGroup(introduction: IntroductionRecord, groupId: string, introductionId: string): void {
  if (introduction.id !== introductionId || introduction.recipientGroupId !== groupId) {
    throw new ApiRouteError("UNPROCESSABLE_STATE", "Introduction does not match the requested group.");
  }
}

async function persistMatchedConversationWhenNeeded(
  decision: IntroductionInterestDecision,
  dependencies: Pick<IntroductionInterestDependencies, "nextConversationId" | "loadConversationParticipantGroups" | "persistMatchedGroupConversation">
): Promise<void> {
  if (decision.approvalState !== "matched") {
    return;
  }

  if (decision.targetGroupId === null) {
    throw new ApiRouteError("UNPROCESSABLE_STATE", "Matched group interest requires a targetGroupId.");
  }

  const participantGroups = await dependencies.loadConversationParticipantGroups([decision.sourceGroupId, decision.targetGroupId]);

  try {
    const matchedConversation = buildMatchedGroupConversation({
      conversationId: dependencies.nextConversationId(),
      sourceIntroductionId: decision.introduction.id,
      sourceGroupId: decision.sourceGroupId,
      targetGroupId: decision.targetGroupId,
      participantGroups
    });

    await dependencies.persistMatchedGroupConversation(matchedConversation);
  } catch (error) {
    throw mapIntroductionDomainError(error);
  }
}
