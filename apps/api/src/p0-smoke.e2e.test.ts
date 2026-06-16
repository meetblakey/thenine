import { describe, expect, it, vi } from "vitest";
import {
  assertIntroductionRecipient,
  buildActionQueueItem,
  buildMatchedGroupConversation,
  buildNotificationIntent,
  computeGroupEligibility
} from "@thenine/domain";
import * as api from "./index.js";
import type { DebriefInterestInput, DebriefResource, PlanResource } from "@thenine/domain";
import type { GroupEligibilityInput } from "@thenine/domain/group-eligibility";

type ApiExports = typeof api & {
  handleGetLaunchpad: typeof api.handleGetLaunchpad;
  handlePostConversationPlanFastTrack: typeof api.handlePostConversationPlanFastTrack;
  handlePostPlanProposalAccept: typeof api.handlePostPlanProposalAccept;
  handlePostPlanRsvp: typeof api.handlePostPlanRsvp;
  handlePostPlanConfirm: typeof api.handlePostPlanConfirm;
  handlePostPlanAttendance: typeof api.handlePostPlanAttendance;
  handlePostPlanDebrief: typeof api.handlePostPlanDebrief;
  handlePostDebriefLearningConsent: typeof api.handlePostDebriefLearningConsent;
};

const apiRoutes = api as ApiExports;

interface OutboxEvent {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventName: string;
  payload: Record<string, unknown>;
}

const sourceGroup: GroupEligibilityInput = {
  groupId: "group_1",
  format: "quartet",
  groupStatus: "pending_publish_approval",
  name: "Sunday Table",
  intent: "serious",
  neighborhoodIds: ["neighborhood_1"],
  availabilityWindows: [
    { startsAt: "2026-06-25T09:00:00.000Z", endsAt: "2026-06-25T11:00:00.000Z", timezone: "Australia/Sydney" }
  ],
  profile: {
    sharedVibe: "low-key dinner and sharp conversation",
    memberCardsComplete: true,
    moderationStatus: "approved"
  },
  memberships: [
    {
      memberId: "member_a",
      membershipStatus: "active",
      memberStatus: "active",
      verificationStatus: "approved",
      publishApprovedAt: "2026-06-16T00:00:00.000Z"
    },
    {
      memberId: "member_b",
      membershipStatus: "active",
      memberStatus: "active",
      verificationStatus: "approved",
      publishApprovedAt: "2026-06-16T00:00:00.000Z"
    }
  ],
  safetyPaused: false
};

const targetGroup: GroupEligibilityInput = {
  ...sourceGroup,
  groupId: "group_2",
  memberships: [
    {
      memberId: "member_c",
      membershipStatus: "active",
      memberStatus: "active",
      verificationStatus: "approved",
      publishApprovedAt: "2026-06-16T00:00:00.000Z"
    },
    {
      memberId: "member_d",
      membershipStatus: "active",
      memberStatus: "active",
      verificationStatus: "approved",
      publishApprovedAt: "2026-06-16T00:00:00.000Z"
    }
  ]
};

describe("P0 end-to-end smoke path", () => {
  it("runs the group-only path from Launchpad eligibility through Plan, debrief, consent, actions, and notifications", async () => {
    const outbox: OutboxEvent[] = [];
    const reserveIdempotencyKey = vi.fn(async () => undefined);
    const appendOutbox = (event: { aggregateType: string; aggregateId: string; eventName: string; payload: Record<string, unknown> }): OutboxEvent => {
      const row = { id: `event_${outbox.length + 1}`, ...event };
      outbox.push(row);

      return row;
    };

    const sourceEligibility = computeGroupEligibility(sourceGroup);
    const targetEligibility = computeGroupEligibility(targetGroup);
    expect(sourceEligibility.status).toBe("eligible");
    expect(targetEligibility.status).toBe("eligible");
    expect(() => assertIntroductionRecipient({ recipientGroupId: "group_1", eligibility: sourceEligibility })).not.toThrow();
    expect(() => assertIntroductionRecipient({ memberId: "member_a", eligibility: sourceEligibility })).toThrow(/recipientGroupId/i);

    const launchpad = await apiRoutes.handleGetLaunchpad(
      { member: { memberId: "member_a", verificationStatus: "approved" } },
      {
        loadActiveGroupForMember: vi.fn(async () => sourceGroup),
        hasQualifiedIntroductionsForGroup: vi.fn(async () => true),
        getNextIntroductionRefreshAt: vi.fn(async () => "2026-06-25T12:00:00.000Z")
      }
    );
    expect(launchpad).toMatchObject({
      activeGroupId: "group_1",
      primaryAction: { kind: "open_first_introduction", groupId: "group_1" }
    });
    expect(JSON.stringify(launchpad)).not.toMatch(/memberInventory|compatibilityScore|reliabilityScore|swipe|boost/i);

    const matchedConversation = buildMatchedGroupConversation({
      conversationId: "conversation_1",
      sourceIntroductionId: "introduction_1",
      sourceGroupId: "group_1",
      targetGroupId: "group_2",
      participantGroups: [
        { groupId: "group_1", memberIds: ["member_a", "member_b"] },
        { groupId: "group_2", memberIds: ["member_c", "member_d"] }
      ]
    });
    appendOutbox(matchedConversation.outboxEvent);
    expect(matchedConversation.conversation).toMatchObject({
      kind: "group_chat",
      groupIds: ["group_1", "group_2"],
      parentConversationId: null
    });
    expect(matchedConversation.safetySurface.actions).toEqual(["report", "block", "leave", "urgent_help", "share_plan"]);

    const proposedPlan = await apiRoutes.handlePostConversationPlanFastTrack(
      { member: { memberId: "member_a" }, idempotencyKey: "idem_fast_track" },
      { conversationId: "conversation_1" },
      { sourceGroupId: "group_1", format: "quartet" },
      {
        reserveIdempotencyKey,
        loadPlanFastTrackAccess: vi.fn(async () => ({
          conversationStatus: "active" as const,
          groupIds: ["group_1", "group_2"],
          availabilityWindows: [
            { groupId: "group_1", startsAt: "2026-06-25T09:00:00.000Z", endsAt: "2026-06-25T11:00:00.000Z", timezone: "Australia/Sydney" },
            { groupId: "group_2", startsAt: "2026-06-25T10:00:00.000Z", endsAt: "2026-06-25T12:00:00.000Z", timezone: "Australia/Sydney" }
          ],
          venueCandidates: [{ venueId: "venue_1", name: "Harbour Bar", venueType: "bar", safetyStatus: "approved" as const }]
        })),
        nextProposalId: () => "proposal_1",
        nextTimeOptionIds: () => ["time_option_1"],
        nextVenueOptionIds: () => ["venue_option_1"],
        now: () => new Date("2026-06-24T08:00:00.000Z"),
        persistPlanFastTrackProposal: vi.fn(async (input) => {
          appendOutbox(input.outboxEvent);

          return input.proposal;
        })
      }
    );
    expect(proposedPlan.proposalState).toBe("proposed");
    expect(proposedPlan.safetyContext.safetyActions).toEqual(["report", "block", "leave", "urgent_help", "share_plan"]);

    let plan = await apiRoutes.handlePostPlanProposalAccept(
      { member: { memberId: "member_a" }, idempotencyKey: "idem_accept_proposal" },
      { proposalId: "proposal_1" },
      { selectedTimeOptionId: "time_option_1", selectedVenueOptionId: "venue_option_1", rsvpDeadlineAt: "2026-06-25T08:00:00.000Z" },
      {
        reserveIdempotencyKey,
        loadPlanFastTrackProposalAccess: vi.fn(async () => proposedPlan),
        nextPlanId: () => "plan_1",
        now: () => new Date("2026-06-24T08:05:00.000Z"),
        persistAcceptedPlanFastTrack: vi.fn(async (input) => {
          appendOutbox(input.outboxEvent);

          return input.plan;
        })
      }
    );
    expect(plan.status).toBe("rsvp_requested");

    const rsvpRequiredMemberIds = ["member_a", "member_c"];
    const rsvpInputs = [
      { memberId: "member_a", groupId: "group_1", idempotencyKey: "idem_rsvp_a" },
      { memberId: "member_c", groupId: "group_2", idempotencyKey: "idem_rsvp_c" }
    ];

    for (const rsvpInput of rsvpInputs) {
      plan = await apiRoutes.handlePostPlanRsvp(
        { member: { memberId: rsvpInput.memberId }, idempotencyKey: rsvpInput.idempotencyKey },
        { planId: "plan_1" },
        { status: "yes" },
        {
          reserveIdempotencyKey,
          loadPlanRsvpAccess: vi.fn(async () => ({ plan, groupId: rsvpInput.groupId, requiredMemberIds: rsvpRequiredMemberIds })),
          now: () => new Date("2026-06-24T09:00:00.000Z"),
          persistPlanRsvp: vi.fn(async (input) => {
            appendOutbox(input.outboxEvent);

            return input.plan;
          })
        }
      );
    }
    expect(plan.rsvps.map((rsvp) => rsvp.status)).toEqual(["yes", "yes"]);

    plan = await apiRoutes.handlePostPlanConfirm(
      { member: { memberId: "member_a" }, idempotencyKey: "idem_confirm_plan" },
      { planId: "plan_1" },
      {},
      {
        reserveIdempotencyKey,
        loadPlanConfirmationAccess: vi.fn(async () => ({ plan, requiredMemberIds: rsvpRequiredMemberIds })),
        now: () => new Date("2026-06-24T09:05:00.000Z"),
        persistPlanConfirmation: vi.fn(async (input) => {
          appendOutbox(input.outboxEvent);

          return input.plan;
        })
      }
    );
    expect(plan.status).toBe("confirmed");

    const confirmedEvent = outbox.find((event) => event.eventName === "plan.confirmed");
    expect(confirmedEvent).toBeDefined();
    const rsvpAction = buildActionQueueItem({
      itemId: "action_rsvp_1",
      memberId: "member_c",
      groupId: "group_2",
      sourceEventId: confirmedEvent?.id ?? null,
      sourceEventName: confirmedEvent?.eventName ?? "plan.confirmed",
      targetType: "plan",
      targetId: "plan_1",
      actionKind: "rsvp_plan",
      deadlineAt: "2026-06-25T08:00:00.000Z",
      dismissible: false,
      createdAt: "2026-06-24T09:06:00.000Z"
    });
    expect(rsvpAction.item.sourceEventId).toBe(confirmedEvent?.id);
    expect(rsvpAction.outboxEvent.payload.sourceEventId).toBe(confirmedEvent?.id);

    const notification = buildNotificationIntent({
      sourceEventId: confirmedEvent?.id ?? null,
      eventName: confirmedEvent?.eventName ?? "plan.confirmed",
      aggregateType: "plan",
      aggregateId: "plan_1",
      memberId: "member_c",
      groupId: "group_2",
      dedupeKey: "plan_1:member_c:confirmed"
    });
    expect(notification).toMatchObject({
      sourceEventId: confirmedEvent?.id,
      memberId: "member_c",
      groupId: "group_2",
      category: "plan"
    });

    await apiRoutes.handlePostPlanAttendance(
      { member: { memberId: "member_a" }, idempotencyKey: "idem_attendance" },
      { planId: "plan_1" },
      { status: "attended" },
      {
        reserveIdempotencyKey,
        loadAttendanceAccess: vi.fn(async () => ({ plan, groupId: "group_1" })),
        nextAttendanceId: () => "attendance_1",
        now: () => new Date("2026-06-25T12:05:00.000Z"),
        persistAttendanceConfirmation: vi.fn(async (input) => input.response)
      }
    );

    const completedPlan: PlanResource = { ...plan, status: "completed" };
    const firstDebrief = await apiRoutes.handlePostPlanDebrief(
      { member: { memberId: "member_a" }, idempotencyKey: "idem_debrief_a" },
      { planId: "plan_1" },
      { attendanceStatus: "attended", qualityRating: 4, safetyConcern: false, interests: [{ targetMemberId: "member_c", signal: "crush" }] },
      {
        reserveIdempotencyKey,
        loadDebriefAccess: vi.fn(async () => ({ plan: completedPlan, groupId: "group_1", existingInterests: [] })),
        nextDebriefId: () => "debrief_1",
        now: () => new Date("2026-06-25T12:10:00.000Z"),
        persistDebriefSubmission: vi.fn(async (input) => {
          appendOutbox(input.outboxEvent);

          return { debrief: input.debrief, mutualEdges: input.mutualEdges };
        })
      }
    );
    expect(firstDebrief.mutualEdges).toEqual([]);

    const existingInterests: DebriefInterestInput[] = [
      { planId: "plan_1", sourceMemberId: "member_a", targetMemberId: "member_c", signal: "crush" }
    ];
    const secondDebrief = await apiRoutes.handlePostPlanDebrief(
      { member: { memberId: "member_c" }, idempotencyKey: "idem_debrief_c" },
      { planId: "plan_1" },
      { attendanceStatus: "attended", qualityRating: 5, safetyConcern: false, interests: [{ targetMemberId: "member_a", signal: "crush" }] },
      {
        reserveIdempotencyKey,
        loadDebriefAccess: vi.fn(async () => ({ plan: completedPlan, groupId: "group_2", existingInterests })),
        nextDebriefId: () => "debrief_2",
        now: () => new Date("2026-06-25T12:15:00.000Z"),
        persistDebriefSubmission: vi.fn(async (input) => {
          appendOutbox(input.outboxEvent);

          return { debrief: input.debrief, mutualEdges: input.mutualEdges };
        })
      }
    );
    expect(secondDebrief.mutualEdges).toEqual([{ planId: "plan_1", memberAId: "member_a", memberBId: "member_c", edgeType: "crush" }]);
    expect(JSON.stringify(firstDebrief)).not.toMatch(/member_c|compatibilityScore|reliabilityScore/i);

    const consentResult = await apiRoutes.handlePostDebriefLearningConsent(
      { member: { memberId: "member_a" }, idempotencyKey: "idem_learning_consent" },
      { debriefId: "debrief_1" },
      { action: "grant" },
      {
        reserveIdempotencyKey,
        loadDebriefConsentAccess: vi.fn(async () => ({
          debrief: firstDebrief.debrief as DebriefResource,
          plan: completedPlan,
          groupId: "group_1",
          existingConsent: null,
          activeFeatureSnapshotIds: []
        })),
        nextConsentId: () => "consent_1",
        nextFeatureSnapshotId: () => "feature_snapshot_1",
        now: () => new Date("2026-06-25T12:20:00.000Z"),
        computeConsentExpiry: () => "2027-06-25T12:20:00.000Z",
        persistDebriefLearningConsent: vi.fn(async (input) => {
          appendOutbox(input.outboxEvent);
        })
      }
    );
    expect(consentResult).toMatchObject({
      consent: { status: "granted", debriefId: "debrief_1", planId: "plan_1", memberId: "member_a" },
      featureSnapshot: { id: "feature_snapshot_1", consentId: "consent_1" }
    });

    expect(reserveIdempotencyKey).toHaveBeenCalled();
    expect(outbox.map((event) => event.eventName)).toEqual(
      expect.arrayContaining([
        "introduction.mutual_match_created",
        "plan.fast_track_proposed",
        "plan.fast_track_accepted",
        "plan.rsvp_changed",
        "plan.confirmed",
        "debrief.submitted",
        "debrief.learning_consent_changed"
      ])
    );
    expect(JSON.stringify(outbox)).not.toMatch(/rawDebriefInterest|rawReportNarrative|compatibilityScore|reliabilityScore|rawProviderDocument/i);
  });
});
