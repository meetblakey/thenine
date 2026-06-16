export interface EligibilityFixtureInput {
  groupId: string;
  format: "quartet" | "social_pod";
  groupStatus: "draft" | "pending_member" | "pending_publish_approval" | "eligible" | "paused" | "ineligible" | "dissolved";
  name: string | null;
  intent: string | null;
  neighborhoodIds: string[];
  availabilityWindows: Array<{ startsAt: string; endsAt: string; timezone: string }>;
  profile: {
    sharedVibe: string | null;
    memberCardsComplete: boolean;
    moderationStatus: "not_required" | "pending" | "approved" | "rejected" | "held_for_review";
  };
  memberships: Array<{
    memberId: string;
    membershipStatus: "invited" | "active" | "left" | "removed" | "paused";
    memberStatus: "active" | "suspended" | "banned" | "deleted";
    verificationStatus: "not_started" | "pending" | "retry_required" | "approved" | "rejected" | "appeal_pending";
    publishApprovedAt: string | null;
  }>;
  safetyPaused: boolean;
}

type EligibilityFixtureOverrides = Omit<Partial<EligibilityFixtureInput>, "profile" | "memberships"> & {
  profile?: Partial<EligibilityFixtureInput["profile"]>;
  memberships?: EligibilityFixtureInput["memberships"];
};

export function eligibleQuartetGroup(overrides: EligibilityFixtureOverrides = {}): EligibilityFixtureInput {
  const base: EligibilityFixtureInput = {
    groupId: "group_quartet_1",
    format: "quartet",
    groupStatus: "pending_publish_approval",
    name: "Sunday Table",
    intent: "serious",
    neighborhoodIds: ["neighborhood_1"],
    availabilityWindows: [
      { startsAt: "2026-06-20T09:00:00.000Z", endsAt: "2026-06-20T11:00:00.000Z", timezone: "Australia/Sydney" }
    ],
    profile: {
      sharedVibe: "low-key dinners and sharp conversation",
      memberCardsComplete: true,
      moderationStatus: "approved"
    },
    memberships: [
      {
        memberId: "member_1",
        membershipStatus: "active",
        memberStatus: "active",
        verificationStatus: "approved",
        publishApprovedAt: "2026-06-16T00:00:00.000Z"
      },
      {
        memberId: "member_2",
        membershipStatus: "active",
        memberStatus: "active",
        verificationStatus: "approved",
        publishApprovedAt: "2026-06-16T00:00:00.000Z"
      }
    ],
    safetyPaused: false
  };

  return mergeEligibilityFixture(base, overrides);
}

export function eligibleSocialPodGroup(overrides: EligibilityFixtureOverrides = {}): EligibilityFixtureInput {
  return mergeEligibilityFixture(
    eligibleQuartetGroup({
      groupId: "group_social_pod_1",
      format: "social_pod",
      memberships: [
        {
          memberId: "member_1",
          membershipStatus: "active",
          memberStatus: "active",
          verificationStatus: "approved",
          publishApprovedAt: "2026-06-16T00:00:00.000Z"
        }
      ]
    }),
    overrides
  );
}

function mergeEligibilityFixture(
  base: EligibilityFixtureInput,
  overrides: EligibilityFixtureOverrides
): EligibilityFixtureInput {
  return {
    ...base,
    ...overrides,
    profile: {
      ...base.profile,
      ...overrides.profile
    },
    memberships: overrides.memberships === undefined ? base.memberships : overrides.memberships
  };
}
