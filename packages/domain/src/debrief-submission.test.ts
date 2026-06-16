import { describe, expect, it } from "vitest";
import * as domain from "./index.js";
import type { DebriefSignal, PlanResource } from "./types.js";

interface DebriefSubmissionInput {
  debriefId: string;
  plan: PlanResource;
  memberId: string;
  groupId: string;
  attendanceStatus: "attended" | "did_not_attend" | "skipped";
  qualityRating?: number;
  safetyConcern: boolean;
  interests?: Array<{ targetMemberId: string; signal: DebriefSignal }>;
  existingInterests: Array<{ planId: string; sourceMemberId: string; targetMemberId: string; signal: DebriefSignal }>;
  submittedAt: string;
}

interface DebriefSubmissionResult {
  debrief: {
    id: string;
    planId: string;
    memberId: string;
    attendanceStatus: string;
    qualityRating: number | null;
    safetyConcern: boolean;
    submittedAt: string;
  };
  interests: Array<{
    planId: string;
    sourceMemberId: string;
    targetMemberId: string;
    signal: DebriefSignal;
    visibilityStatus: "private";
  }>;
  mutualEdges: Array<{ planId: string; memberAId: string; memberBId: string; edgeType: Exclude<DebriefSignal, "none" | "skipped"> }>;
  outboxEvent: {
    aggregateType: "debrief";
    aggregateId: string;
    eventName: "debrief.submitted";
    eventVersion: 1;
    payload: {
      debriefId: string;
      planId: string;
      submittedAt: string;
    };
  };
}

type DebriefDomainExports = typeof domain & {
  buildDebriefSubmission?: (input: DebriefSubmissionInput) => DebriefSubmissionResult;
};

const debriefDomain = domain as DebriefDomainExports;

const completedPlan = (): PlanResource => ({
  id: "plan_1",
  format: "quartet",
  status: "completed",
  startsAt: "2026-06-22T09:00:00.000Z",
  venueName: "Harbour Bar",
  groupIds: ["group_1", "group_2"],
  conversationId: "conversation_1",
  venueId: "venue_1",
  manualVenueName: null,
  manualVenueAddress: null,
  endsAt: "2026-06-22T11:00:00.000Z",
  rsvpDeadlineAt: "2026-06-21T09:00:00.000Z",
  options: [],
  rsvps: []
});

describe("debrief submission domain", () => {
  it("keeps one-sided interest private and out of the debrief event", () => {
    expect(debriefDomain.buildDebriefSubmission).toBeTypeOf("function");

    const result = debriefDomain.buildDebriefSubmission?.({
      debriefId: "debrief_1",
      plan: completedPlan(),
      memberId: "member_a",
      groupId: "group_1",
      attendanceStatus: "attended",
      qualityRating: 4,
      safetyConcern: false,
      interests: [{ targetMemberId: "member_c", signal: "crush" }],
      existingInterests: [],
      submittedAt: "2026-06-22T12:00:00.000Z"
    });

    expect(result?.debrief).toEqual({
      id: "debrief_1",
      planId: "plan_1",
      memberId: "member_a",
      attendanceStatus: "attended",
      qualityRating: 4,
      safetyConcern: false,
      submittedAt: "2026-06-22T12:00:00.000Z"
    });
    expect(result?.interests).toEqual([
      {
        planId: "plan_1",
        sourceMemberId: "member_a",
        targetMemberId: "member_c",
        signal: "crush",
        visibilityStatus: "private"
      }
    ]);
    expect(result?.mutualEdges).toEqual([]);
    expect(result?.outboxEvent).toEqual({
      aggregateType: "debrief",
      aggregateId: "debrief_1",
      eventName: "debrief.submitted",
      eventVersion: 1,
      payload: {
        debriefId: "debrief_1",
        planId: "plan_1",
        submittedAt: "2026-06-22T12:00:00.000Z"
      }
    });
    expect(JSON.stringify(result?.outboxEvent)).not.toContain("member_c");
    expect(JSON.stringify(result?.outboxEvent)).not.toContain("crush");
  });

  it("reveals only mutual edges to the submitting member", () => {
    expect(debriefDomain.buildDebriefSubmission).toBeTypeOf("function");

    const result = debriefDomain.buildDebriefSubmission?.({
      debriefId: "debrief_2",
      plan: completedPlan(),
      memberId: "member_a",
      groupId: "group_1",
      attendanceStatus: "attended",
      qualityRating: 5,
      safetyConcern: false,
      interests: [{ targetMemberId: "member_c", signal: "crush" }],
      existingInterests: [{ planId: "plan_1", sourceMemberId: "member_c", targetMemberId: "member_a", signal: "crush" }],
      submittedAt: "2026-06-22T12:00:00.000Z"
    });

    expect(result?.mutualEdges).toEqual([{ planId: "plan_1", memberAId: "member_a", memberBId: "member_c", edgeType: "crush" }]);
  });
});
