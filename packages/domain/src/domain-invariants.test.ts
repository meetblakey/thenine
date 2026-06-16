import { describe, expect, it } from "vitest";
import {
  allocateIntroductionCandidates,
  assertNoMemberScopedDatingInventoryRoutes,
  assertSafetyActionsWithinOneTap,
  assertStaffAccessAudited,
  buildNotificationIntent,
  canUseDebriefPreferenceForRanking,
  computeMutualDebriefEdges,
  createBreakoutConversation,
  createGroupConversation,
  evaluateGroupEligibility,
  getVisibleMutualEdgesForMember,
  sanitizeAnalyticsPayload,
  serializeIntroductionForClient,
  validateCalendarImportPersistable,
  validateProviderWebhookEnvelope
} from "./index.js";
import type { GroupEligibilityInput } from "./types.js";

const completeGroup = (
  overrides: Partial<GroupEligibilityInput> = {}
): GroupEligibilityInput => ({
  groupId: "group-1",
  format: "quartet",
  status: "pending_publish_approval",
  name: "Saturday people",
  intent: "serious",
  neighborhoodIds: ["n-1"],
  availabilityWindows: [
    { startsAt: "2026-07-03T09:00:00.000Z", endsAt: "2026-07-03T11:00:00.000Z", timezone: "Australia/Sydney" }
  ],
  publishApprovedAt: "2026-07-01T00:00:00.000Z",
  profile: {
    sharedVibe: "Low-key dinner and good conversation",
    moderationStatus: "approved",
    publishedAt: "2026-07-01T00:00:00.000Z"
  },
  members: [
    {
      memberId: "member-a",
      status: "active",
      memberStatus: "active",
      verificationStatus: "approved",
      publishApprovedAt: "2026-07-01T00:00:00.000Z"
    },
    {
      memberId: "member-b",
      status: "active",
      memberStatus: "active",
      verificationStatus: "approved",
      publishApprovedAt: "2026-07-01T00:00:00.000Z"
    }
  ],
  safetyPaused: false,
  ...overrides
});

const firstCompleteGroupMember = (): GroupEligibilityInput["members"][number] => {
  const [member] = completeGroup().members;

  if (member === undefined) {
    throw new Error("complete group fixture must include at least one member");
  }

  return member;
};

describe("group eligibility invariants", () => {
  it("marks a complete verified quartet group eligible", () => {
    expect(evaluateGroupEligibility(completeGroup())).toEqual({
      groupId: "group-1",
      eligible: true,
      eligibilityStatus: "eligible",
      blockers: []
    });
  });

  it("blocks quartet groups unless exactly two active verified members are present", () => {
    const result = evaluateGroupEligibility(
      completeGroup({
        members: [
          {
            memberId: "member-a",
            status: "active",
            memberStatus: "active",
            verificationStatus: "approved",
            publishApprovedAt: "2026-07-01T00:00:00.000Z"
          }
        ]
      })
    );

    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("quartet_requires_exactly_two_active_verified_members");
  });

  it("keeps unverified members out of discovery even when the group shell is complete", () => {
    const result = evaluateGroupEligibility(
      completeGroup({
        members: [
          firstCompleteGroupMember(),
          {
            memberId: "member-b",
            status: "active",
            memberStatus: "active",
            verificationStatus: "pending",
            publishApprovedAt: "2026-07-01T00:00:00.000Z"
          }
        ]
      })
    );

    expect(result.eligible).toBe(false);
    expect(result.blockers).toContain("member_verification_not_approved");
  });

  it("allows a one-member social-pod only as a complete verified group", () => {
    const result = evaluateGroupEligibility(
      completeGroup({
        format: "social_pod",
        members: [firstCompleteGroupMember()]
      })
    );

    expect(result.eligible).toBe(true);
    expect(result.blockers).toEqual([]);
  });
});

describe("group-first distribution invariants", () => {
  it("rejects dating inventory routes that accept memberId as the recipient", () => {
    expect(() =>
      assertNoMemberScopedDatingInventoryRoutes([
        {
          method: "GET",
          path: "/v1/members/{memberId}/introductions",
          accepts: ["memberId"],
          returnsDatingInventory: true
        }
      ])
    ).toThrow(/member-scoped dating inventory/i);
  });

  it("preserves the free baseline before applying additive stack size", () => {
    expect(
      allocateIntroductionCandidates({
        sourceGroupId: "group-1",
        candidateGroupIds: ["group-2", "group-3", "group-4", "group-5"],
        freeBaselineSize: 3,
        extraStackSize: 2,
        exposureBudgetByCandidate: {
          "group-2": 1,
          "group-3": 1,
          "group-4": 1,
          "group-5": 1
        }
      })
    ).toEqual({
      selectedCandidateIds: ["group-2", "group-3", "group-4", "group-5"],
      baselineCount: 3,
      entitlementExtraCount: 1
    });
  });

  it("never serializes ranking or compatibility scores to clients", () => {
    expect(
      serializeIntroductionForClient({
        id: "intro-1",
        recipientGroupId: "group-1",
        kind: "quartet_group",
        targetGroupId: "group-2",
        targetPlanId: null,
        rankPosition: 1,
        score: 0.9123,
        compatibilityScore: 0.8765,
        reasonCodes: ["shared_availability"],
        expiresAt: "2026-07-02T00:00:00.000Z"
      })
    ).toEqual({
      id: "intro-1",
      recipientGroupId: "group-1",
      kind: "quartet_group",
      targetGroupId: "group-2",
      rankPosition: 1,
      reasonCodes: ["shared_availability"],
      expiresAt: "2026-07-02T00:00:00.000Z"
    });
  });
});

describe("conversation and breakout invariants", () => {
  it("creates group-owned conversations and rejects member-owned dating chats", () => {
    expect(() =>
      createGroupConversation({
        conversationId: "conversation-1",
        groupIds: ["group-1"],
        participantMemberIds: ["member-a", "member-b"]
      })
    ).toThrow(/group-owned/i);

    expect(
      createGroupConversation({
        conversationId: "conversation-1",
        groupIds: ["group-1", "group-2"],
        participantMemberIds: ["member-a", "member-b", "member-c", "member-d"]
      })
    ).toMatchObject({
      id: "conversation-1",
      kind: "group_chat",
      groupIds: ["group-1", "group-2"],
      parentConversationId: null
    });
  });

  it("creates breakout threads only from accepted consent requests with parent context", () => {
    expect(() =>
      createBreakoutConversation({
        conversationId: "breakout-1",
        request: {
          id: "request-1",
          parentConversationId: "conversation-1",
          requesterMemberId: "member-a",
          recipientMemberId: "member-c",
          requesterGroupId: "group-1",
          recipientGroupId: "group-2",
          status: "pending"
        },
        participantMemberIds: ["member-a", "member-c"]
      })
    ).toThrow(/accepted consent/i);

    const acceptedRequest = {
      id: "request-1",
      parentConversationId: "conversation-1",
      requesterMemberId: "member-a",
      recipientMemberId: "member-c",
      requesterGroupId: "group-1",
      recipientGroupId: "group-2",
      status: "accepted" as const
    };

    expect(
      createBreakoutConversation({
        conversationId: "breakout-1",
        request: acceptedRequest,
        participantMemberIds: ["member-a", "member-c"]
      })
    ).toMatchObject({
      id: "breakout-1",
      kind: "breakout",
      groupIds: ["group-1", "group-2"],
      parentConversationId: "conversation-1",
      participantMemberIds: ["member-a", "member-c"]
    });

    expect(() =>
      createBreakoutConversation({
        conversationId: "breakout-1",
        request: acceptedRequest,
        participantMemberIds: ["member-a", "member-b"]
      })
    ).toThrow(/requester and recipient/i);
  });
});

describe("debrief privacy and recommendation consent", () => {
  it("does not reveal one-sided post-meetup interest to the target member", () => {
    const edges = computeMutualDebriefEdges([
      {
        planId: "plan-1",
        sourceMemberId: "member-a",
        targetMemberId: "member-c",
        signal: "crush"
      }
    ]);

    expect(getVisibleMutualEdgesForMember({ viewerMemberId: "member-c", edges })).toEqual([]);
  });

  it("reveals only mutual post-meetup interest edges to involved members", () => {
    const edges = computeMutualDebriefEdges([
      {
        planId: "plan-1",
        sourceMemberId: "member-a",
        targetMemberId: "member-c",
        signal: "friend"
      },
      {
        planId: "plan-1",
        sourceMemberId: "member-c",
        targetMemberId: "member-a",
        signal: "crush"
      }
    ]);

    expect(getVisibleMutualEdgesForMember({ viewerMemberId: "member-a", edges })).toEqual([
      {
        planId: "plan-1",
        memberAId: "member-a",
        memberBId: "member-c",
        edgeType: "both"
      }
    ]);
  });

  it("uses debrief preference data for ranking only with active explicit consent", () => {
    expect(
      canUseDebriefPreferenceForRanking({
        status: "granted",
        grantedAt: "2026-07-01T00:00:00.000Z",
        revokedAt: null
      })
    ).toBe(true);
    expect(
      canUseDebriefPreferenceForRanking({
        status: "granted",
        grantedAt: "2026-07-01T00:00:00.000Z",
        revokedAt: "2026-07-02T00:00:00.000Z"
      })
    ).toBe(false);
    expect(canUseDebriefPreferenceForRanking(null)).toBe(false);
  });
});

describe("notification, safety, provider, staff, and analytics invariants", () => {
  it("creates notification intents only from persisted source events and dedupe keys", () => {
    expect(() =>
      buildNotificationIntent({
        sourceEventId: null,
        eventName: "group.eligible",
        aggregateType: "group",
        aggregateId: "group-1",
        memberId: "member-a",
        groupId: "group-1",
        dedupeKey: "group-eligible:group-1:member-a"
      })
    ).toThrow(/source event/i);
  });

  it("requires all safety actions within one tap on active risky surfaces", () => {
    expect(() =>
      assertSafetyActionsWithinOneTap({
        surface: "group_chat",
        active: true,
        actions: ["report", "block", "leave", "urgent_help"]
      })
    ).toThrow(/share_plan/i);
  });

  it("requires report block leave urgent and share plan actions on active plan and debrief surfaces", () => {
    expect(() =>
      assertSafetyActionsWithinOneTap({
        surface: "plan",
        active: true,
        actions: ["report", "block", "urgent_help", "share_plan"]
      })
    ).toThrow(/leave/i);

    expect(() =>
      assertSafetyActionsWithinOneTap({
        surface: "debrief",
        active: true,
        actions: ["report", "block", "leave", "urgent_help"]
      })
    ).toThrow(/share_plan/i);
  });

  it("requires provider webhook signature validation and idempotency", () => {
    expect(() =>
      validateProviderWebhookEnvelope({
        provider: "persona",
        signatureVerified: true,
        eventId: "persona-event-1",
        idempotencyKey: null
      })
    ).toThrow(/idempotency/i);
  });

  it("requires audit logs for staff access to restricted data", () => {
    expect(() =>
      assertStaffAccessAudited({
        staffId: "staff-1",
        action: "read",
        resourceType: "safety_report",
        resourceId: "report-1",
        auditLogId: null
      })
    ).toThrow(/audit/i);
  });

  it("strips prohibited sensitive fields from analytics payloads", () => {
    expect(
      sanitizeAnalyticsPayload({
        groupId: "group-1",
        compatibilityScore: 0.91,
        nested: {
          reportNarrative: "private",
          kept: "ok"
        }
      })
    ).toEqual({
      groupId: "group-1",
      nested: {
        kept: "ok"
      }
    });
  });

  it("rejects raw calendar event content before persistence", () => {
    expect(() =>
      validateCalendarImportPersistable({
        memberId: "member-a",
        eventTitle: "Dinner with Blake",
        windowStart: "2026-07-03T09:00:00.000Z",
        windowEnd: "2026-07-03T11:00:00.000Z"
      })
    ).toThrow(/raw calendar/i);
  });
});
