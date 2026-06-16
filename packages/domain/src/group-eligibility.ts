export class DomainInvariantError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "DomainInvariantError";
  }
}

export type VerificationStatus = "not_started" | "pending" | "retry_required" | "approved" | "rejected" | "appeal_pending";
export type MemberStatus = "active" | "suspended" | "banned" | "deleted";
export type GroupFormat = "quartet" | "social_pod";
export type GroupStatus = "draft" | "pending_member" | "pending_publish_approval" | "eligible" | "paused" | "ineligible" | "dissolved";
export type MembershipStatus = "invited" | "active" | "left" | "removed" | "paused";
export type ModerationStatus = "not_required" | "pending" | "approved" | "rejected" | "held_for_review";

export type EligibilityBlocker =
  | "quartet_requires_two_active_verified_members"
  | "social_pod_requires_complete_verified_group"
  | "member_verification_required"
  | "member_status_required"
  | "profile_required"
  | "availability_required"
  | "profile_moderation_required"
  | "publish_approval_required"
  | "safety_paused"
  | "group_not_active";

export interface AvailabilityWindow {
  startsAt: string;
  endsAt: string;
  timezone: string;
}

export interface GroupMembershipEligibilityInput {
  memberId: string;
  membershipStatus: MembershipStatus;
  memberStatus: MemberStatus;
  verificationStatus: VerificationStatus;
  publishApprovedAt: string | null;
}

export interface GroupEligibilityInput {
  groupId: string;
  format: GroupFormat;
  groupStatus: GroupStatus;
  name: string | null;
  intent: string | null;
  neighborhoodIds: string[];
  availabilityWindows: AvailabilityWindow[];
  profile: {
    sharedVibe: string | null;
    memberCardsComplete: boolean;
    moderationStatus: ModerationStatus;
  };
  memberships: GroupMembershipEligibilityInput[];
  safetyPaused: boolean;
}

export interface GroupEligibilityResult {
  groupId: string;
  status: "eligible" | "ineligible";
  blockers: EligibilityBlocker[];
}

export interface IntroductionRecipientCommand {
  recipientGroupId?: string;
  memberId?: string;
  eligibility: GroupEligibilityResult;
}

export function computeGroupEligibility(input: GroupEligibilityInput): GroupEligibilityResult {
  const blockers = new Set<EligibilityBlocker>();
  const activeMemberships = input.memberships.filter((membership) => membership.membershipStatus === "active");
  const activeVerifiedMemberships = activeMemberships.filter(
    (membership) => membership.memberStatus === "active" && membership.verificationStatus === "approved"
  );

  if (input.groupStatus === "paused" || input.groupStatus === "dissolved") {
    blockers.add("group_not_active");
  }

  if (input.format === "quartet" && activeVerifiedMemberships.length !== 2) {
    blockers.add("quartet_requires_two_active_verified_members");
  }

  if (input.format === "social_pod" && (activeVerifiedMemberships.length < 1 || activeVerifiedMemberships.length > 2)) {
    blockers.add("social_pod_requires_complete_verified_group");
  }

  if (activeMemberships.some((membership) => membership.memberStatus !== "active")) {
    blockers.add("member_status_required");
  }

  if (activeMemberships.some((membership) => membership.verificationStatus !== "approved")) {
    blockers.add("member_verification_required");
  }

  if (
    input.name === null ||
    input.intent === null ||
    input.neighborhoodIds.length === 0 ||
    input.profile.sharedVibe === null ||
    !input.profile.memberCardsComplete
  ) {
    blockers.add("profile_required");
  }

  if (input.availabilityWindows.length === 0) {
    blockers.add("availability_required");
  }

  if (input.profile.moderationStatus !== "approved" && input.profile.moderationStatus !== "not_required") {
    blockers.add("profile_moderation_required");
  }

  if (activeMemberships.some((membership) => membership.publishApprovedAt === null)) {
    blockers.add("publish_approval_required");
  }

  if (input.safetyPaused) {
    blockers.add("safety_paused");
  }

  const eligibilityBlockers = Array.from(blockers);

  return {
    groupId: input.groupId,
    status: eligibilityBlockers.length === 0 ? "eligible" : "ineligible",
    blockers: eligibilityBlockers
  };
}

export function assertIntroductionRecipient(command: IntroductionRecipientCommand): void {
  if (command.memberId !== undefined) {
    throw new DomainInvariantError(
      "MEMBER_DISCOVERY_FORBIDDEN",
      "Introductions must be requested for recipientGroupId, never memberId."
    );
  }

  if (command.recipientGroupId === undefined) {
    throw new DomainInvariantError("RECIPIENT_GROUP_REQUIRED", "Introduction requests require recipientGroupId.");
  }

  if (command.eligibility.groupId !== command.recipientGroupId || command.eligibility.status !== "eligible") {
    throw new DomainInvariantError("GROUP_INELIGIBLE", "Only complete verified Groups can receive introductions.");
  }
}
