import { describe, expect, it } from "vitest";
import * as domain from "./index.js";
import type { PlanFormat } from "./types.js";

interface FastTrackInput {
  proposalId: string;
  conversationId: string;
  createdByMemberId: string;
  sourceGroupId: string;
  format: PlanFormat;
  conversation: {
    status: "active" | "write_limited" | "expired" | "closed";
    groupIds: string[];
  };
  availabilityWindows: Array<{ groupId: string; startsAt: string; endsAt: string; timezone: string }>;
  venueCandidates: Array<{ venueId: string; name: string; venueType: string; safetyStatus: "approved" | "held" | "blocked" }>;
  timeOptionIds: string[];
  venueOptionIds: string[];
  createdAt: string;
}

interface FastTrackProposal {
  id: string;
  conversationId: string;
  createdByMemberId: string;
  sourceGroupId: string;
  groupIds: string[];
  format: PlanFormat;
  proposalState: "proposed" | "manual_required" | "accepted" | "expired";
  confidence: "recommended" | "manual";
  timeOptions: Array<{ id: string; startsAt: string; endsAt: string; timezone: string }>;
  venueOptions: Array<{ id: string; venueId: string; label: string; venueType: string; safetyStatus: "approved" }>;
  safetyContext: { sharePlanAvailable: true; safetyActions: string[] };
  createdAt: string;
}

type PlanFastTrackExports = typeof domain & {
  buildPlanFastTrackProposal?: (input: FastTrackInput) => {
    proposal: FastTrackProposal;
    outboxEvent: {
      aggregateType: "conversation";
      aggregateId: string;
      eventName: "plan.fast_track_proposed";
      eventVersion: 1;
      payload: {
        proposalId: string;
        conversationId: string;
        sourceGroupId: string;
        groupIds: string[];
        timeOptionCount: number;
        venueOptionCount: number;
      };
    };
  };
  acceptPlanFastTrackProposal?: (input: {
    proposal: FastTrackProposal;
    planId: string;
    selectedTimeOptionId: string;
    selectedVenueOptionId: string;
    rsvpDeadlineAt: string;
    acceptedAt: string;
  }) => {
    plan: {
      id: string;
      status: "rsvp_requested";
      conversationId: string;
      startsAt: string;
      endsAt: string;
      venueId: string;
      venueName: string;
      groupIds: string[];
      rsvpDeadlineAt: string;
    };
    outboxEvent: {
      aggregateType: "plan";
      aggregateId: string;
      eventName: "plan.fast_track_accepted";
      eventVersion: 1;
      payload: {
        proposalId: string;
        planId: string;
        conversationId: string;
        groupIds: string[];
        rsvpDeadlineAt: string;
      };
    };
  };
};

const planFastTrackDomain = domain as PlanFastTrackExports;

const baseInput = (overrides: Partial<FastTrackInput> = {}): FastTrackInput => ({
  proposalId: "proposal_1",
  conversationId: "conversation_1",
  createdByMemberId: "member_1",
  sourceGroupId: "group_1",
  format: "quartet",
  conversation: {
    status: "active",
    groupIds: ["group_1", "group_2"]
  },
  availabilityWindows: [
    { groupId: "group_1", startsAt: "2026-06-25T09:00:00.000Z", endsAt: "2026-06-25T11:00:00.000Z", timezone: "Australia/Sydney" },
    { groupId: "group_2", startsAt: "2026-06-25T10:00:00.000Z", endsAt: "2026-06-25T12:00:00.000Z", timezone: "Australia/Sydney" }
  ],
  venueCandidates: [
    { venueId: "venue_blocked", name: "Blocked Room", venueType: "bar", safetyStatus: "blocked" },
    { venueId: "venue_1", name: "Harbour Bar", venueType: "bar", safetyStatus: "approved" }
  ],
  timeOptionIds: ["time_1"],
  venueOptionIds: ["venue_option_1"],
  createdAt: "2026-06-24T08:00:00.000Z",
  ...overrides
});

describe("Plan Fast Track domain", () => {
  it("builds a recommended proposal from group availability and approved venues", () => {
    expect(planFastTrackDomain.buildPlanFastTrackProposal).toBeTypeOf("function");

    const result = planFastTrackDomain.buildPlanFastTrackProposal?.(baseInput());

    expect(result?.proposal).toEqual({
      id: "proposal_1",
      conversationId: "conversation_1",
      createdByMemberId: "member_1",
      sourceGroupId: "group_1",
      groupIds: ["group_1", "group_2"],
      format: "quartet",
      proposalState: "proposed",
      confidence: "recommended",
      timeOptions: [
        {
          id: "time_1",
          startsAt: "2026-06-25T10:00:00.000Z",
          endsAt: "2026-06-25T11:00:00.000Z",
          timezone: "Australia/Sydney"
        }
      ],
      venueOptions: [
        {
          id: "venue_option_1",
          venueId: "venue_1",
          label: "Harbour Bar",
          venueType: "bar",
          safetyStatus: "approved"
        }
      ],
      safetyContext: {
        sharePlanAvailable: true,
        safetyActions: ["report", "block", "leave", "urgent_help", "share_plan"]
      },
      createdAt: "2026-06-24T08:00:00.000Z"
    });
    expect(result?.outboxEvent).toEqual({
      aggregateType: "conversation",
      aggregateId: "conversation_1",
      eventName: "plan.fast_track_proposed",
      eventVersion: 1,
      payload: {
        proposalId: "proposal_1",
        conversationId: "conversation_1",
        sourceGroupId: "group_1",
        groupIds: ["group_1", "group_2"],
        timeOptionCount: 1,
        venueOptionCount: 1
      }
    });
  });

  it("rejects closed conversations and source groups outside the conversation", () => {
    expect(planFastTrackDomain.buildPlanFastTrackProposal).toBeTypeOf("function");

    expect(() =>
      planFastTrackDomain.buildPlanFastTrackProposal?.(
        baseInput({
          conversation: { status: "closed", groupIds: ["group_1", "group_2"] }
        })
      )
    ).toThrow(/closed/i);
    expect(() => planFastTrackDomain.buildPlanFastTrackProposal?.(baseInput({ sourceGroupId: "group_3" }))).toThrow(/source group/i);
  });

  it("accepts a proposal into an RSVP-requested Plan without bypassing RSVP rules", () => {
    expect(planFastTrackDomain.buildPlanFastTrackProposal).toBeTypeOf("function");
    expect(planFastTrackDomain.acceptPlanFastTrackProposal).toBeTypeOf("function");

    const proposal = planFastTrackDomain.buildPlanFastTrackProposal?.(baseInput()).proposal as FastTrackProposal;
    const result = planFastTrackDomain.acceptPlanFastTrackProposal?.({
      proposal,
      planId: "plan_1",
      selectedTimeOptionId: "time_1",
      selectedVenueOptionId: "venue_option_1",
      rsvpDeadlineAt: "2026-06-25T08:00:00.000Z",
      acceptedAt: "2026-06-24T08:05:00.000Z"
    });

    expect(result?.plan).toMatchObject({
      id: "plan_1",
      status: "rsvp_requested",
      conversationId: "conversation_1",
      startsAt: "2026-06-25T10:00:00.000Z",
      endsAt: "2026-06-25T11:00:00.000Z",
      venueId: "venue_1",
      venueName: "Harbour Bar",
      groupIds: ["group_1", "group_2"],
      rsvpDeadlineAt: "2026-06-25T08:00:00.000Z"
    });
    expect(result?.outboxEvent).toEqual({
      aggregateType: "plan",
      aggregateId: "plan_1",
      eventName: "plan.fast_track_accepted",
      eventVersion: 1,
      payload: {
        proposalId: "proposal_1",
        planId: "plan_1",
        conversationId: "conversation_1",
        groupIds: ["group_1", "group_2"],
        rsvpDeadlineAt: "2026-06-25T08:00:00.000Z"
      }
    });
  });
});
