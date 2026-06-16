import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";
import type { PlanFormat } from "@thenine/domain";

interface AuthenticatedMember {
  memberId: string;
}

interface PlanFastTrackContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
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

type PlanFastTrackApiExports = typeof api & {
  POST_CONVERSATION_PLAN_FAST_TRACK_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  POST_PLAN_PROPOSAL_ACCEPT_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handlePostConversationPlanFastTrack?: (
    context: PlanFastTrackContext,
    params: { conversationId: string },
    body: { sourceGroupId: string; format: PlanFormat },
    dependencies: {
      reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
      loadPlanFastTrackAccess: (
        conversationId: string,
        memberId: string
      ) => Promise<{
        conversationStatus: "active" | "write_limited" | "expired" | "closed";
        groupIds: string[];
        availabilityWindows: Array<{ groupId: string; startsAt: string; endsAt: string; timezone: string }>;
        venueCandidates: Array<{ venueId: string; name: string; venueType: string; safetyStatus: "approved" | "held" | "blocked" }>;
      }>;
      nextProposalId: () => string;
      nextTimeOptionIds: (count: number) => string[];
      nextVenueOptionIds: (count: number) => string[];
      now: () => Date;
      persistPlanFastTrackProposal: (input: Record<string, unknown>) => Promise<FastTrackProposal>;
    }
  ) => Promise<FastTrackProposal>;
  handlePostPlanProposalAccept?: (
    context: PlanFastTrackContext,
    params: { proposalId: string },
    body: { selectedTimeOptionId: string; selectedVenueOptionId: string; rsvpDeadlineAt: string },
    dependencies: {
      reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
      loadPlanFastTrackProposalAccess: (proposalId: string, memberId: string) => Promise<FastTrackProposal>;
      nextPlanId: () => string;
      now: () => Date;
      persistAcceptedPlanFastTrack: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    }
  ) => Promise<Record<string, unknown>>;
};

const planFastTrackApi = api as PlanFastTrackApiExports;
const member: AuthenticatedMember = { memberId: "member_1" };

const proposal = (): FastTrackProposal => ({
  id: "proposal_1",
  conversationId: "conversation_1",
  createdByMemberId: "member_1",
  sourceGroupId: "group_1",
  groupIds: ["group_1", "group_2"],
  format: "quartet",
  proposalState: "proposed",
  confidence: "recommended",
  timeOptions: [{ id: "time_1", startsAt: "2026-06-25T10:00:00.000Z", endsAt: "2026-06-25T11:00:00.000Z", timezone: "Australia/Sydney" }],
  venueOptions: [{ id: "venue_option_1", venueId: "venue_1", label: "Harbour Bar", venueType: "bar", safetyStatus: "approved" }],
  safetyContext: { sharePlanAvailable: true, safetyActions: ["report", "block", "leave", "urgent_help", "share_plan"] },
  createdAt: "2026-06-24T08:00:00.000Z"
});

describe("Plan Fast Track API routes", () => {
  it("publishes documented Fast Track route metadata", () => {
    expect(planFastTrackApi.POST_CONVERSATION_PLAN_FAST_TRACK_ROUTE).toEqual({
      method: "POST",
      path: "/v1/conversations/{conversationId}/plan-fast-track",
      auth: "Conversation participant",
      requiresIdempotencyKey: true
    });
    expect(planFastTrackApi.POST_PLAN_PROPOSAL_ACCEPT_ROUTE).toEqual({
      method: "POST",
      path: "/v1/plan-proposals/{proposalId}/accept",
      auth: "Conversation participant",
      requiresIdempotencyKey: true
    });
  });

  it("persists Fast Track proposals after idempotency and conversation access checks", async () => {
    expect(planFastTrackApi.handlePostConversationPlanFastTrack).toBeTypeOf("function");

    const calls: string[] = [];
    const persistPlanFastTrackProposal = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("persist-proposal");

      return (input as { proposal: FastTrackProposal }).proposal;
    });

    const result = await planFastTrackApi.handlePostConversationPlanFastTrack?.(
      { member, idempotencyKey: "idem-fast-track" },
      { conversationId: "conversation_1" },
      { sourceGroupId: "group_1", format: "quartet" },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        loadPlanFastTrackAccess: vi.fn(async () => {
          calls.push("access");

          return {
            conversationStatus: "active" as const,
            groupIds: ["group_1", "group_2"],
            availabilityWindows: [
              { groupId: "group_1", startsAt: "2026-06-25T09:00:00.000Z", endsAt: "2026-06-25T11:00:00.000Z", timezone: "Australia/Sydney" },
              { groupId: "group_2", startsAt: "2026-06-25T10:00:00.000Z", endsAt: "2026-06-25T12:00:00.000Z", timezone: "Australia/Sydney" }
            ],
            venueCandidates: [{ venueId: "venue_1", name: "Harbour Bar", venueType: "bar", safetyStatus: "approved" as const }]
          };
        }),
        nextProposalId: () => "proposal_1",
        nextTimeOptionIds: () => ["time_1"],
        nextVenueOptionIds: () => ["venue_option_1"],
        now: () => new Date("2026-06-24T08:00:00.000Z"),
        persistPlanFastTrackProposal
      }
    );

    expect(calls).toEqual(["idempotency", "access", "persist-proposal"]);
    expect(result).toMatchObject({
      id: "proposal_1",
      conversationId: "conversation_1",
      proposalState: "proposed",
      timeOptions: [{ id: "time_1", startsAt: "2026-06-25T10:00:00.000Z", endsAt: "2026-06-25T11:00:00.000Z" }]
    });
    expect(persistPlanFastTrackProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxEvent: expect.objectContaining({
          eventName: "plan.fast_track_proposed",
          payload: expect.objectContaining({ proposalId: "proposal_1", conversationId: "conversation_1" })
        })
      })
    );
  });

  it("accepts a proposal into an RSVP-requested Plan", async () => {
    expect(planFastTrackApi.handlePostPlanProposalAccept).toBeTypeOf("function");

    const calls: string[] = [];
    const persistAcceptedPlanFastTrack = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("persist-plan");

      return (input as { plan: Record<string, unknown> }).plan;
    });

    const result = await planFastTrackApi.handlePostPlanProposalAccept?.(
      { member, idempotencyKey: "idem-accept" },
      { proposalId: "proposal_1" },
      { selectedTimeOptionId: "time_1", selectedVenueOptionId: "venue_option_1", rsvpDeadlineAt: "2026-06-25T08:00:00.000Z" },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        loadPlanFastTrackProposalAccess: vi.fn(async () => {
          calls.push("proposal-access");

          return proposal();
        }),
        nextPlanId: () => "plan_1",
        now: () => new Date("2026-06-24T08:05:00.000Z"),
        persistAcceptedPlanFastTrack
      }
    );

    expect(calls).toEqual(["idempotency", "proposal-access", "persist-plan"]);
    expect(result).toMatchObject({
      id: "plan_1",
      status: "rsvp_requested",
      conversationId: "conversation_1",
      rsvpDeadlineAt: "2026-06-25T08:00:00.000Z"
    });
    expect(persistAcceptedPlanFastTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxEvent: expect.objectContaining({
          eventName: "plan.fast_track_accepted",
          payload: expect.objectContaining({ proposalId: "proposal_1", planId: "plan_1" })
        })
      })
    );
  });
});
