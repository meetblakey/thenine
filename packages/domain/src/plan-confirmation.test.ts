import { describe, expect, it } from "vitest";
import * as domain from "./index.js";
import type { PlanResource, SafetyAction } from "./types.js";

interface PlanConfirmationInput {
  plan: PlanResource;
  requiredMemberIds: string[];
  confirmedAt: string;
}

interface PlanConfirmationResult {
  plan: PlanResource;
  outboxEvent: {
    aggregateType: "plan";
    aggregateId: string;
    eventName: "plan.confirmed";
    eventVersion: 1;
    payload: {
      planId: string;
      startsAt: string;
      venueName: string;
      groupIds: string[];
    };
  };
  safetySurface: {
    surface: "plan";
    active: true;
    actions: SafetyAction[];
  };
}

type PlanDomainExports = typeof domain & {
  buildPlanConfirmation?: (input: PlanConfirmationInput) => PlanConfirmationResult;
};

const planDomain = domain as PlanDomainExports;

const confirmablePlan = (): PlanResource => ({
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
    { memberId: "member_a", groupId: "group_1", status: "yes", respondedAt: "2026-06-20T10:00:00.000Z" },
    { memberId: "member_b", groupId: "group_1", status: "yes", respondedAt: "2026-06-20T10:02:00.000Z" }
  ]
});

describe("Plan confirmation domain", () => {
  it("confirms a Plan only after required RSVPs and emits the confirmed event", () => {
    expect(planDomain.buildPlanConfirmation).toBeTypeOf("function");

    const result = planDomain.buildPlanConfirmation?.({
      plan: confirmablePlan(),
      requiredMemberIds: ["member_a", "member_b"],
      confirmedAt: "2026-06-20T10:05:00.000Z"
    });

    expect(result?.plan).toMatchObject({
      id: "plan_1",
      status: "confirmed",
      startsAt: "2026-06-22T09:00:00.000Z",
      venueName: "Harbour Bar"
    });
    expect(result?.outboxEvent).toEqual({
      aggregateType: "plan",
      aggregateId: "plan_1",
      eventName: "plan.confirmed",
      eventVersion: 1,
      payload: {
        planId: "plan_1",
        startsAt: "2026-06-22T09:00:00.000Z",
        venueName: "Harbour Bar",
        groupIds: ["group_1", "group_2"]
      }
    });
    expect(() => {
      if (result === undefined) {
        throw new Error("buildPlanConfirmation returned no result");
      }

      domain.assertSafetyActionsWithinOneTap(result.safetySurface);
    }).not.toThrow();
  });

  it("rejects confirmation without required RSVPs or exact venue details", () => {
    expect(planDomain.buildPlanConfirmation).toBeTypeOf("function");

    expect(() =>
      planDomain.buildPlanConfirmation?.({
        plan: {
          ...confirmablePlan(),
          rsvps: [{ memberId: "member_a", groupId: "group_1", status: "yes", respondedAt: "2026-06-20T10:00:00.000Z" }]
        },
        requiredMemberIds: ["member_a", "member_b"],
        confirmedAt: "2026-06-20T10:05:00.000Z"
      })
    ).toThrow(/required rsvps/i);

    expect(() =>
      planDomain.buildPlanConfirmation?.({
        plan: { ...confirmablePlan(), venueName: null, venueId: null },
        requiredMemberIds: ["member_a", "member_b"],
        confirmedAt: "2026-06-20T10:05:00.000Z"
      })
    ).toThrow(/venue/i);
  });
});
