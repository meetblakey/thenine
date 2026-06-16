import { describe, expect, it } from "vitest";
import * as domain from "./index.js";
import type { PlanResource } from "./types.js";

type RsvpStatus = "yes" | "no" | "maybe";

interface PlanRsvpInput {
  plan: PlanResource;
  memberId: string;
  groupId: string;
  status: RsvpStatus;
  reasonCode?: string;
  requiredMemberIds: string[];
  respondedAt: string;
}

interface PlanRsvpResult {
  plan: PlanResource;
  outboxEvent: {
    aggregateType: "plan";
    aggregateId: string;
    eventName: "plan.rsvp_changed";
    eventVersion: 1;
    payload: {
      planId: string;
      memberId: string;
      groupId: string;
      status: RsvpStatus;
      allRequiredReceived: boolean;
    };
  };
}

type PlanDomainExports = typeof domain & {
  buildPlanRsvpChange?: (input: PlanRsvpInput) => PlanRsvpResult;
};

const planDomain = domain as PlanDomainExports;

const rsvpRequestedPlan = (): PlanResource => ({
  id: "plan_1",
  format: "quartet",
  status: "rsvp_requested",
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
  rsvps: [
    { memberId: "member_a", groupId: "group_1", status: "pending", respondedAt: null },
    { memberId: "member_b", groupId: "group_1", status: "pending", respondedAt: null }
  ]
});

describe("Plan RSVP domain", () => {
  it("records an RSVP and emits allRequiredReceived only when required members said yes", () => {
    expect(planDomain.buildPlanRsvpChange).toBeTypeOf("function");

    const first = planDomain.buildPlanRsvpChange?.({
      plan: rsvpRequestedPlan(),
      memberId: "member_a",
      groupId: "group_1",
      status: "yes",
      requiredMemberIds: ["member_a", "member_b"],
      respondedAt: "2026-06-20T10:00:00.000Z"
    });

    expect(first?.plan.status).toBe("rsvp_requested");
    expect(first?.plan.rsvps).toEqual([
      { memberId: "member_a", groupId: "group_1", status: "yes", respondedAt: "2026-06-20T10:00:00.000Z" },
      { memberId: "member_b", groupId: "group_1", status: "pending", respondedAt: null }
    ]);
    expect(first?.outboxEvent.payload).toEqual({
      planId: "plan_1",
      memberId: "member_a",
      groupId: "group_1",
      status: "yes",
      allRequiredReceived: false
    });

    if (first === undefined) {
      throw new Error("buildPlanRsvpChange returned no first result");
    }

    const second = planDomain.buildPlanRsvpChange?.({
      plan: first.plan,
      memberId: "member_b",
      groupId: "group_1",
      status: "yes",
      requiredMemberIds: ["member_a", "member_b"],
      respondedAt: "2026-06-20T10:02:00.000Z"
    });

    expect(second?.outboxEvent).toEqual({
      aggregateType: "plan",
      aggregateId: "plan_1",
      eventName: "plan.rsvp_changed",
      eventVersion: 1,
      payload: {
        planId: "plan_1",
        memberId: "member_b",
        groupId: "group_1",
        status: "yes",
        allRequiredReceived: true
      }
    });
  });

  it("rejects RSVP changes after the RSVP window is closed", () => {
    expect(planDomain.buildPlanRsvpChange).toBeTypeOf("function");

    expect(() =>
      planDomain.buildPlanRsvpChange?.({
        plan: { ...rsvpRequestedPlan(), status: "confirmed" },
        memberId: "member_a",
        groupId: "group_1",
        status: "yes",
        requiredMemberIds: ["member_a", "member_b"],
        respondedAt: "2026-06-20T10:00:00.000Z"
      })
    ).toThrow(/rsvp/i);
  });
});
