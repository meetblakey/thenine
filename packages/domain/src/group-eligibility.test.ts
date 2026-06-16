import { describe, expect, it } from "vitest";
import { eligibleQuartetGroup, eligibleSocialPodGroup } from "@thenine/testing/group-fixtures";
import { assertIntroductionRecipient, computeGroupEligibility, DomainInvariantError } from "./group-eligibility.js";

describe("computeGroupEligibility", () => {
  it("marks a complete verified quartet group eligible for introductions", () => {
    const result = computeGroupEligibility(eligibleQuartetGroup());

    expect(result).toEqual({
      groupId: "group_quartet_1",
      status: "eligible",
      blockers: []
    });
  });

  it("blocks quartet groups unless exactly two active verified members are present", () => {
    const result = computeGroupEligibility(
      eligibleQuartetGroup({
        memberships: [
          {
            memberId: "member_1",
            membershipStatus: "active",
            memberStatus: "active",
            verificationStatus: "approved",
            publishApprovedAt: "2026-06-16T00:00:00.000Z"
          }
        ]
      })
    );

    expect(result.status).toBe("ineligible");
    expect(result.blockers).toContain("quartet_requires_two_active_verified_members");
  });

  it("allows a complete verified one-member social-pod group to remain group-modeled", () => {
    const result = computeGroupEligibility(eligibleSocialPodGroup());

    expect(result).toEqual({
      groupId: "group_social_pod_1",
      status: "eligible",
      blockers: []
    });
  });

  it("blocks distribution while any active member verification is not approved", () => {
    const result = computeGroupEligibility(
      eligibleQuartetGroup({
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
            verificationStatus: "pending",
            publishApprovedAt: "2026-06-16T00:00:00.000Z"
          }
        ]
      })
    );

    expect(result.status).toBe("ineligible");
    expect(result.blockers).toContain("member_verification_required");
  });

  it("blocks distribution until profile, availability, moderation, safety, and publish approvals are complete", () => {
    const result = computeGroupEligibility(
      eligibleQuartetGroup({
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
            verificationStatus: "approved",
            publishApprovedAt: "2026-06-16T00:00:00.000Z"
          }
        ],
        safetyPaused: true
      })
    );

    expect(result.status).toBe("ineligible");
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "profile_required",
        "availability_required",
        "profile_moderation_required",
        "publish_approval_required",
        "safety_paused"
      ])
    );
  });
});

describe("assertIntroductionRecipient", () => {
  it("rejects member-level dating inventory requests", () => {
    const eligibility = computeGroupEligibility(eligibleQuartetGroup());

    expect(() => {
      assertIntroductionRecipient({
        memberId: "member_1",
        recipientGroupId: "group_quartet_1",
        eligibility
      });
    }).toThrow(new DomainInvariantError("MEMBER_DISCOVERY_FORBIDDEN", "Introductions must be requested for recipientGroupId, never memberId."));
  });

  it("rejects introduction requests for ineligible groups", () => {
    const eligibility = computeGroupEligibility(eligibleQuartetGroup({ safetyPaused: true }));

    expect(() => {
      assertIntroductionRecipient({
        recipientGroupId: "group_quartet_1",
        eligibility
      });
    }).toThrow(new DomainInvariantError("GROUP_INELIGIBLE", "Only complete verified Groups can receive introductions."));
  });
});
