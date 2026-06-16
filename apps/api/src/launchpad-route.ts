import { LAUNCHPAD_ROUTE_CONTRACT } from "@thenine/api-contracts";
import { computeLaunchpadReadiness } from "@thenine/domain/launchpad-readiness";
import type { LaunchpadReadinessResult } from "@thenine/domain/launchpad-readiness";
import type { GroupEligibilityInput, VerificationStatus } from "@thenine/domain/group-eligibility";

export const GET_LAUNCHPAD_ROUTE = {
  method: LAUNCHPAD_ROUTE_CONTRACT.method,
  path: LAUNCHPAD_ROUTE_CONTRACT.path,
  auth: LAUNCHPAD_ROUTE_CONTRACT.auth
} as const;

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "VERIFICATION_REQUIRED"
  | "GROUP_ACCESS_DENIED"
  | "GROUP_NOT_COMPLETE"
  | "GROUP_INELIGIBLE"
  | "NOT_FOUND"
  | "CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "PROVIDER_SIGNATURE_INVALID"
  | "CONVERSATION_CLOSED"
  | "BREAKOUT_INELIGIBLE"
  | "MESSAGE_MODERATION_HELD"
  | "PLAN_NOT_CONFIRMABLE"
  | "RSVP_CLOSED"
  | "DEBRIEF_NOT_AVAILABLE"
  | "CONSENT_REQUIRED"
  | "ENTITLEMENT_REQUIRED"
  | "MEDIA_NOT_APPROVED"
  | "RATE_LIMITED"
  | "UNPROCESSABLE_STATE";

export class ApiRouteError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ApiRouteError";
  }
}

export interface AuthenticatedMember {
  memberId: string;
  verificationStatus: VerificationStatus;
}

export interface LaunchpadRequestContext {
  member: AuthenticatedMember | null;
}

export interface LaunchpadRouteDependencies {
  loadActiveGroupForMember: (memberId: string) => Promise<GroupEligibilityInput | null>;
  hasQualifiedIntroductionsForGroup: (groupId: string) => Promise<boolean>;
  getNextIntroductionRefreshAt: (groupId: string) => Promise<string | null>;
}

export async function handleGetLaunchpad(
  context: LaunchpadRequestContext,
  dependencies: LaunchpadRouteDependencies
): Promise<LaunchpadReadinessResult> {
  if (context.member === null) {
    throw new ApiRouteError("UNAUTHENTICATED", "GET /v1/launchpad requires a member session.");
  }

  const activeGroup = await dependencies.loadActiveGroupForMember(context.member.memberId);

  if (activeGroup === null) {
    return computeLaunchpadReadiness({
      memberId: context.member.memberId,
      memberVerificationStatus: context.member.verificationStatus,
      activeGroup: null,
      hasQualifiedIntroductions: false,
      nextIntroductionRefreshAt: null
    });
  }

  const [hasQualifiedIntroductions, nextIntroductionRefreshAt] = await Promise.all([
    dependencies.hasQualifiedIntroductionsForGroup(activeGroup.groupId),
    dependencies.getNextIntroductionRefreshAt(activeGroup.groupId)
  ]);

  return computeLaunchpadReadiness({
    memberId: context.member.memberId,
    memberVerificationStatus: context.member.verificationStatus,
    activeGroup,
    hasQualifiedIntroductions,
    nextIntroductionRefreshAt
  });
}
