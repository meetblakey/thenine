import { describe, expect, it } from "vitest";
import { eligibleQuartetGroup } from "@thenine/testing/group-fixtures";
import * as domain from "./index.js";
import type { EligibilityFixtureInput } from "@thenine/testing/group-fixtures";

interface LaunchpadReadinessInput {
  memberId: string;
  memberVerificationStatus: EligibilityFixtureInput["memberships"][number]["verificationStatus"];
  activeGroup: EligibilityFixtureInput | null;
  hasQualifiedIntroductions: boolean;
  nextIntroductionRefreshAt: string | null;
}

interface LaunchpadReadinessResult {
  memberId: string;
  activeGroupId: string | null;
  readinessStatus: string;
  blockers: string[];
  primaryAction: { kind: string; groupId: string | null };
  secondaryActions: Array<{ kind: string; groupId: string | null }>;
  safetyActions: Array<{ kind: string; surface: string; groupId: string | null }>;
  refreshesAt: string | null;
}

type LaunchpadDomainExports = typeof domain & {
  computeLaunchpadReadiness?: (input: LaunchpadReadinessInput) => LaunchpadReadinessResult;
};

const launchpadDomain = domain as LaunchpadDomainExports;

function computeLaunchpadReadiness(input: LaunchpadReadinessInput): LaunchpadReadinessResult {
  expect(launchpadDomain.computeLaunchpadReadiness).toBeTypeOf("function");

  return launchpadDomain.computeLaunchpadReadiness?.(input) as LaunchpadReadinessResult;
}

describe("computeLaunchpadReadiness", () => {
  it("keeps verification as the first blocker before any group-owned dating readiness", () => {
    const result = computeLaunchpadReadiness({
      memberId: "member_1",
      memberVerificationStatus: "pending",
      activeGroup: null,
      hasQualifiedIntroductions: false,
      nextIntroductionRefreshAt: null
    });

    expect(result).toMatchObject({
      memberId: "member_1",
      activeGroupId: null,
      readinessStatus: "verification_blocked",
      blockers: ["verification_required"],
      primaryAction: { kind: "start_verification", groupId: null }
    });
  });

  it("directs verified members without an active group to create or join a group", () => {
    const result = computeLaunchpadReadiness({
      memberId: "member_1",
      memberVerificationStatus: "approved",
      activeGroup: null,
      hasQualifiedIntroductions: false,
      nextIntroductionRefreshAt: null
    });

    expect(result).toMatchObject({
      activeGroupId: null,
      readinessStatus: "needs_group",
      blockers: ["create_or_join_group"],
      primaryAction: { kind: "create_group", groupId: null }
    });
  });

  it("maps group eligibility blockers to exact Launchpad blockers and one primary action", () => {
    const result = computeLaunchpadReadiness({
      memberId: "member_1",
      memberVerificationStatus: "approved",
      activeGroup: eligibleQuartetGroup({
        name: null,
        availabilityWindows: [],
        profile: {
          sharedVibe: null,
          memberCardsComplete: false,
          moderationStatus: "held_for_review"
        },
        memberships: [
          {
            memberId: "member_1",
            membershipStatus: "active",
            memberStatus: "active",
            verificationStatus: "approved",
            publishApprovedAt: null
          },
          {
            memberId: "member_2",
            membershipStatus: "active",
            memberStatus: "active",
            verificationStatus: "pending",
            publishApprovedAt: null
          }
        ],
        safetyPaused: true
      }),
      hasQualifiedIntroductions: false,
      nextIntroductionRefreshAt: null
    });

    expect(result.blockers).toEqual([
      "invite_pending",
      "profile_required",
      "availability_required",
      "publish_approval_required",
      "moderation_required",
      "safety_paused"
    ]);
    expect(result.primaryAction).toMatchObject({ kind: "invite_friend", groupId: "group_quartet_1" });
    expect(result.secondaryActions.length).toBeLessThanOrEqual(2);
  });

  it("marks eligible groups ready to open the first Introduction without exposing inventory or ranking scores", () => {
    const result = computeLaunchpadReadiness({
      memberId: "member_1",
      memberVerificationStatus: "approved",
      activeGroup: eligibleQuartetGroup(),
      hasQualifiedIntroductions: true,
      nextIntroductionRefreshAt: "2026-06-20T12:00:00.000Z"
    });

    expect(result).toMatchObject({
      activeGroupId: "group_quartet_1",
      readinessStatus: "eligible",
      blockers: ["eligible_for_first_introduction"],
      primaryAction: { kind: "open_first_introduction", groupId: "group_quartet_1" },
      refreshesAt: "2026-06-20T12:00:00.000Z"
    });
    expect(result.safetyActions.map((action) => action.kind)).toEqual(["report", "block", "leave", "urgent_help", "share_plan"]);

    const serialized = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
    for (const forbiddenField of ["introductions", "memberInventory", "compatibilityScore", "reliabilityScore"]) {
      expect(serialized).not.toHaveProperty(forbiddenField);
    }
  });

  it("shows honest thin-city actions without fake cards when no qualified inventory exists", () => {
    const result = computeLaunchpadReadiness({
      memberId: "member_1",
      memberVerificationStatus: "approved",
      activeGroup: eligibleQuartetGroup(),
      hasQualifiedIntroductions: false,
      nextIntroductionRefreshAt: "2026-06-21T12:00:00.000Z"
    });

    expect(result).toMatchObject({
      readinessStatus: "thin_city_waiting",
      blockers: ["thin_city_no_inventory"],
      primaryAction: { kind: "edit_neighborhoods", groupId: "group_quartet_1" }
    });
    expect(result.secondaryActions.map((action) => action.kind)).toEqual(["add_availability", "join_pod_waitlist"]);
    expect(result).not.toHaveProperty("introductions");
  });
});
