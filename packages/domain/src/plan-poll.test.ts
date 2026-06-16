import { describe, expect, it } from "vitest";
import * as domain from "./index.js";
import type { SafetyAction } from "./types.js";

interface PlanPollInput {
  planId: string;
  conversationId: string;
  cityId: string;
  format: "quartet" | "social_pod";
  createdByMemberId: string;
  conversation: {
    status: "active" | "write_limited" | "expired" | "closed";
    groupIds: string[];
  };
  timeOptions: Array<{ id: string; startsAt: string; endsAt: string }>;
  venueOptions?: Array<{ id: string; venueId?: string; manualLabel?: string }>;
  createdAt: string;
}

interface PlanPollResult {
  plan: {
    id: string;
    format: "quartet" | "social_pod";
    status: "polling";
    startsAt: null;
    venueName: null;
    groupIds: string[];
    conversationId: string;
    venueId: null;
    manualVenueName: null;
    manualVenueAddress: null;
    endsAt: null;
    rsvpDeadlineAt: null;
    options: Array<{ id: string; optionType: string; label: string; startsAt: string | null; venueId: string | null }>;
    rsvps: [];
  };
  outboxEvent: {
    aggregateType: "plan";
    aggregateId: string;
    eventName: "plan.poll_created";
    eventVersion: 1;
    payload: {
      planId: string;
      conversationId: string;
      optionIds: string[];
    };
  };
  safetySurface: {
    surface: "plan";
    active: true;
    actions: SafetyAction[];
  };
}

type PlanDomainExports = typeof domain & {
  buildPlanPoll?: (input: PlanPollInput) => PlanPollResult;
};

const planDomain = domain as PlanDomainExports;

describe("Plan poll domain", () => {
  it("drafts a group-owned plan poll with a persisted event", () => {
    expect(planDomain.buildPlanPoll).toBeTypeOf("function");

    const result = planDomain.buildPlanPoll?.({
      planId: "plan_1",
      conversationId: "conversation_1",
      cityId: "city_1",
      format: "quartet",
      createdByMemberId: "member_a",
      conversation: {
        status: "active",
        groupIds: ["group_1", "group_2"]
      },
      timeOptions: [
        {
          id: "option_time_1",
          startsAt: "2026-06-22T09:00:00.000Z",
          endsAt: "2026-06-22T11:00:00.000Z"
        }
      ],
      venueOptions: [{ id: "option_venue_1", manualLabel: "Harbour Bar" }],
      createdAt: "2026-06-20T10:00:00.000Z"
    });

    expect(result?.plan).toEqual({
      id: "plan_1",
      format: "quartet",
      status: "polling",
      startsAt: null,
      venueName: null,
      groupIds: ["group_1", "group_2"],
      conversationId: "conversation_1",
      venueId: null,
      manualVenueName: null,
      manualVenueAddress: null,
      endsAt: null,
      rsvpDeadlineAt: null,
      options: [
        {
          id: "option_time_1",
          optionType: "time",
          label: "Jun 22, 2026, 09:00-11:00",
          startsAt: "2026-06-22T09:00:00.000Z",
          venueId: null
        },
        {
          id: "option_venue_1",
          optionType: "venue",
          label: "Harbour Bar",
          startsAt: null,
          venueId: null
        }
      ],
      rsvps: []
    });
    expect(result?.outboxEvent).toEqual({
      aggregateType: "plan",
      aggregateId: "plan_1",
      eventName: "plan.poll_created",
      eventVersion: 1,
      payload: {
        planId: "plan_1",
        conversationId: "conversation_1",
        optionIds: ["option_time_1", "option_venue_1"]
      }
    });
    expect(() => {
      if (result === undefined) {
        throw new Error("buildPlanPoll returned no result");
      }

      domain.assertSafetyActionsWithinOneTap(result.safetySurface);
    }).not.toThrow();
  });

  it("rejects plan polls outside active group-owned conversations", () => {
    expect(planDomain.buildPlanPoll).toBeTypeOf("function");

    expect(() =>
      planDomain.buildPlanPoll?.({
        planId: "plan_2",
        conversationId: "conversation_1",
        cityId: "city_1",
        format: "quartet",
        createdByMemberId: "member_a",
        conversation: { status: "closed", groupIds: ["group_1", "group_2"] },
        timeOptions: [{ id: "option_time_1", startsAt: "2026-06-22T09:00:00.000Z", endsAt: "2026-06-22T11:00:00.000Z" }],
        createdAt: "2026-06-20T10:00:00.000Z"
      })
    ).toThrow(/closed/i);

    expect(() =>
      planDomain.buildPlanPoll?.({
        planId: "plan_3",
        conversationId: "conversation_1",
        cityId: "city_1",
        format: "quartet",
        createdByMemberId: "member_a",
        conversation: { status: "active", groupIds: ["group_1"] },
        timeOptions: [{ id: "option_time_1", startsAt: "2026-06-22T09:00:00.000Z", endsAt: "2026-06-22T11:00:00.000Z" }],
        createdAt: "2026-06-20T10:00:00.000Z"
      })
    ).toThrow(/group-owned/i);
  });
});
