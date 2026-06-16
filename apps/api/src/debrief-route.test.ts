import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";
import type { DebriefSignal, PlanResource } from "@thenine/domain";

interface AuthenticatedMember {
  memberId: string;
}

interface DebriefMutationContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

interface DebriefDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadDebriefAccess: (
    planId: string,
    memberId: string
  ) => Promise<{
    plan: PlanResource;
    groupId: string;
    existingInterests: Array<{ planId: string; sourceMemberId: string; targetMemberId: string; signal: DebriefSignal }>;
  }>;
  nextDebriefId: () => string;
  now: () => Date;
  persistDebriefSubmission: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

type DebriefApiExports = typeof api & {
  POST_PLAN_DEBRIEF_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handlePostPlanDebrief?: (
    context: DebriefMutationContext,
    params: { planId: string },
    body: {
      attendanceStatus: "attended" | "did_not_attend" | "skipped";
      qualityRating?: number;
      safetyConcern: boolean;
      interests?: Array<{ targetMemberId: string; signal: DebriefSignal }>;
    },
    dependencies: DebriefDependencies
  ) => Promise<Record<string, unknown>>;
};

const debriefApi = api as DebriefApiExports;
const member: AuthenticatedMember = {
  memberId: "member_a"
};

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

describe("Plan debrief API route", () => {
  it("publishes documented Plan debrief route metadata", () => {
    expect(debriefApi.POST_PLAN_DEBRIEF_ROUTE).toEqual({
      method: "POST",
      path: "/v1/plans/{planId}/debriefs",
      auth: "Plan participant",
      requiresIdempotencyKey: true
    });
  });

  it("persists debriefs without exposing one-sided interest in the event payload", async () => {
    expect(debriefApi.handlePostPlanDebrief).toBeTypeOf("function");

    const calls: string[] = [];
    const persistDebriefSubmission = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("persist-debrief");

      return {
        debrief: input.debrief,
        mutualEdges: input.mutualEdges
      };
    });

    const result = await debriefApi.handlePostPlanDebrief?.(
      { member, idempotencyKey: "idem-debrief" },
      { planId: "plan_1" },
      {
        attendanceStatus: "attended",
        qualityRating: 4,
        safetyConcern: false,
        interests: [{ targetMemberId: "member_c", signal: "crush" }]
      },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        loadDebriefAccess: vi.fn(async () => {
          calls.push("access");

          return { plan: completedPlan(), groupId: "group_1", existingInterests: [] };
        }),
        nextDebriefId: () => "debrief_1",
        now: () => new Date("2026-06-22T12:00:00.000Z"),
        persistDebriefSubmission
      }
    );

    expect(calls).toEqual(["idempotency", "access", "persist-debrief"]);
    expect(result).toMatchObject({
      debrief: { id: "debrief_1", planId: "plan_1", attendanceStatus: "attended" },
      mutualEdges: []
    });
    expect(persistDebriefSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxEvent: {
          aggregateType: "debrief",
          aggregateId: "debrief_1",
          eventName: "debrief.submitted",
          eventVersion: 1,
          payload: {
            debriefId: "debrief_1",
            planId: "plan_1",
            submittedAt: "2026-06-22T12:00:00.000Z"
          }
        }
      })
    );
    expect(JSON.stringify(persistDebriefSubmission.mock.calls[0]?.[0])).not.toContain("compatibilityScore");
    expect(JSON.stringify((persistDebriefSubmission.mock.calls[0]?.[0] as { outboxEvent?: unknown }).outboxEvent)).not.toContain("member_c");
  });

  it("requires idempotency before debrief writes", async () => {
    await expect(
      debriefApi.handlePostPlanDebrief?.(
        { member, idempotencyKey: null },
        { planId: "plan_1" },
        { attendanceStatus: "attended", safetyConcern: false },
        {
          reserveIdempotencyKey: vi.fn(),
          loadDebriefAccess: vi.fn(),
          nextDebriefId: () => "debrief_1",
          now: () => new Date("2026-06-22T12:00:00.000Z"),
          persistDebriefSubmission: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
