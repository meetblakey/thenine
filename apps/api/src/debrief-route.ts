import { buildDebriefLearningConsent, buildDebriefSubmission } from "@thenine/domain";
import { DomainInvariantError } from "@thenine/domain/group-eligibility";
import type {
  DebriefInterestInput,
  DebriefLearningConsentAction,
  DebriefLearningConsentResult,
  DebriefResource,
  DebriefSignal,
  DebriefSubmissionResult,
  ExistingDebriefLearningConsent,
  PlanResource
} from "@thenine/domain";
import { ApiRouteError } from "./launchpad-route.js";
import type { ApiErrorCode } from "./launchpad-route.js";

export const POST_PLAN_DEBRIEF_ROUTE = {
  method: "POST",
  path: "/v1/plans/{planId}/debriefs",
  auth: "Plan participant",
  requiresIdempotencyKey: true
} as const;

export const POST_DEBRIEF_LEARNING_CONSENT_ROUTE = {
  method: "POST",
  path: "/v1/debriefs/{debriefId}/learning-consent",
  auth: "Debrief owner",
  requiresIdempotencyKey: true
} as const;

export interface DebriefMutationMember {
  memberId: string;
}

export interface DebriefMutationContext {
  member: DebriefMutationMember | null;
  idempotencyKey: string | null;
}

export interface PlanDebriefBody {
  attendanceStatus: "attended" | "did_not_attend" | "skipped";
  qualityRating?: number;
  safetyConcern: boolean;
  interests?: Array<{ targetMemberId: string; signal: DebriefSignal }>;
}

export interface DebriefLearningConsentBody {
  action: DebriefLearningConsentAction;
}

export interface PlanDebriefDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadDebriefAccess: (
    planId: string,
    memberId: string
  ) => Promise<{ plan: PlanResource; groupId: string; existingInterests: DebriefInterestInput[] }>;
  nextDebriefId: () => string;
  now: () => Date;
  persistDebriefSubmission: (input: DebriefSubmissionResult) => Promise<{ debrief: DebriefSubmissionResult["debrief"]; mutualEdges: DebriefSubmissionResult["mutualEdges"] }>;
}

export interface DebriefLearningConsentDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadDebriefConsentAccess: (
    debriefId: string,
    memberId: string
  ) => Promise<{
    debrief: DebriefResource;
    plan: PlanResource;
    groupId: string;
    existingConsent: ExistingDebriefLearningConsent | null;
    activeFeatureSnapshotIds: string[];
  }>;
  nextConsentId: () => string;
  nextFeatureSnapshotId: () => string;
  now: () => Date;
  computeConsentExpiry: (decidedAt: Date) => string;
  persistDebriefLearningConsent: (input: DebriefLearningConsentResult) => Promise<void>;
}

export interface DebriefLearningConsentRouteResult {
  consent: DebriefLearningConsentResult["consent"];
  featureSnapshot: { id: string; consentId: string } | null;
  deactivatedFeatureSnapshotIds: string[];
}

export async function handlePostPlanDebrief(
  context: DebriefMutationContext,
  params: { planId: string },
  body: PlanDebriefBody,
  dependencies: PlanDebriefDependencies
): Promise<{ debrief: DebriefSubmissionResult["debrief"]; mutualEdges: DebriefSubmissionResult["mutualEdges"] }> {
  const member = requireDebriefMember(context.member);
  await reserveRequiredDebriefIdempotency(
    POST_PLAN_DEBRIEF_ROUTE.method,
    POST_PLAN_DEBRIEF_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  const access = await dependencies.loadDebriefAccess(params.planId, member.memberId);

  try {
    const submission = buildDebriefSubmission({
      debriefId: dependencies.nextDebriefId(),
      plan: access.plan,
      memberId: member.memberId,
      groupId: access.groupId,
      attendanceStatus: body.attendanceStatus,
      ...(body.qualityRating === undefined ? {} : { qualityRating: body.qualityRating }),
      safetyConcern: body.safetyConcern,
      ...(body.interests === undefined ? {} : { interests: body.interests }),
      existingInterests: access.existingInterests,
      submittedAt: dependencies.now().toISOString()
    });

    return await dependencies.persistDebriefSubmission(submission);
  } catch (error) {
    throw mapDebriefDomainError(error);
  }
}

export async function handlePostDebriefLearningConsent(
  context: DebriefMutationContext,
  params: { debriefId: string },
  body: DebriefLearningConsentBody,
  dependencies: DebriefLearningConsentDependencies
): Promise<DebriefLearningConsentRouteResult> {
  const member = requireDebriefMember(context.member);
  await reserveRequiredDebriefIdempotency(
    POST_DEBRIEF_LEARNING_CONSENT_ROUTE.method,
    POST_DEBRIEF_LEARNING_CONSENT_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );
  assertValidDebriefLearningConsentAction(body.action);

  const access = await dependencies.loadDebriefConsentAccess(params.debriefId, member.memberId);
  const decidedAt = dependencies.now();

  try {
    const result = buildDebriefLearningConsent({
      consentId: dependencies.nextConsentId(),
      action: body.action,
      debrief: access.debrief,
      plan: access.plan,
      memberId: member.memberId,
      groupId: access.groupId,
      existingConsent: access.existingConsent,
      activeFeatureSnapshotIds: access.activeFeatureSnapshotIds,
      featureSnapshotId: dependencies.nextFeatureSnapshotId(),
      featureVersion: "p0.1",
      decidedAt: decidedAt.toISOString(),
      expiresAt: dependencies.computeConsentExpiry(decidedAt)
    });

    await dependencies.persistDebriefLearningConsent(result);

    return {
      consent: result.consent,
      featureSnapshot: result.featureSnapshot === null ? null : { id: result.featureSnapshot.id, consentId: result.featureSnapshot.consentId },
      deactivatedFeatureSnapshotIds: result.deactivatedFeatureSnapshotIds
    };
  } catch (error) {
    throw mapDebriefDomainError(error);
  }
}

function requireDebriefMember(member: DebriefMutationMember | null): DebriefMutationMember {
  if (member === null) {
    throw new ApiRouteError("UNAUTHENTICATED", "Debrief routes require a member session.");
  }

  return member;
}

function assertValidDebriefLearningConsentAction(action: string): asserts action is DebriefLearningConsentAction {
  if (action !== "grant" && action !== "decline" && action !== "revoke") {
    throw new ApiRouteError("VALIDATION_ERROR", "Learning consent action must be grant, decline, or revoke.");
  }
}

async function reserveRequiredDebriefIdempotency(
  method: string,
  path: string,
  context: DebriefMutationContext,
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>
): Promise<void> {
  if (context.idempotencyKey === null || context.idempotencyKey.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Mutating routes require Idempotency-Key.");
  }

  const member = requireDebriefMember(context.member);
  await reserveIdempotencyKey(`${method} ${path}`, context.idempotencyKey, member.memberId);
}

function mapDebriefDomainError(error: unknown): Error {
  if (error instanceof DomainInvariantError) {
    return new ApiRouteError(error.code as ApiErrorCode, error.message);
  }

  return error instanceof Error ? error : new ApiRouteError("UNPROCESSABLE_STATE", "Unexpected Debrief route failure.");
}
