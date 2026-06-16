import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";
import type { PlanResource } from "@thenine/domain";

interface AuthenticatedMember {
  memberId: string;
}

interface PlanMutationContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

interface PlanRsvpDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadPlanRsvpAccess: (
    planId: string,
    memberId: string
  ) => Promise<{ plan: PlanResource; groupId: string; requiredMemberIds: string[] }>;
  now: () => Date;
  persistPlanRsvp: (input: Record<string, unknown>) => Promise<PlanResource>;
}

type PlanApiExports = typeof api & {
  POST_PLAN_RSVP_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handlePostPlanRsvp?: (
    context: PlanMutationContext,
    params: { planId: string },
    body: { status: "yes" | "no" | "maybe"; reasonCode?: string },
    dependencies: PlanRsvpDependencies
  ) => Promise<PlanResource>;
};

const planApi = api as PlanApiExports;
const member: AuthenticatedMember = {
  memberId: "member_a"
};

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
  rsvps: [{ memberId: "member_a", groupId: "group_1", status: "pending", respondedAt: null }]
});

describe("Plan RSVP API route", () => {
  it("publishes documented Plan RSVP route metadata", () => {
    expect(planApi.POST_PLAN_RSVP_ROUTE).toEqual({
      method: "POST",
      path: "/v1/plans/{planId}/rsvps",
      auth: "Plan participant",
      requiresIdempotencyKey: true
    });
  });

  it("persists RSVP changes with a plan.rsvp_changed outbox event", async () => {
    expect(planApi.handlePostPlanRsvp).toBeTypeOf("function");

    const calls: string[] = [];
    const persistPlanRsvp = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("persist-rsvp-with-outbox");

      return input.plan as PlanResource;
    });

    const result = await planApi.handlePostPlanRsvp?.(
      { member, idempotencyKey: "idem-rsvp" },
      { planId: "plan_1" },
      { status: "yes" },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        loadPlanRsvpAccess: vi.fn(async () => {
          calls.push("access");

          return { plan: rsvpRequestedPlan(), groupId: "group_1", requiredMemberIds: ["member_a"] };
        }),
        now: () => new Date("2026-06-20T10:00:00.000Z"),
        persistPlanRsvp
      }
    );

    expect(calls).toEqual(["idempotency", "access", "persist-rsvp-with-outbox"]);
    expect(result?.rsvps).toEqual([
      { memberId: "member_a", groupId: "group_1", status: "yes", respondedAt: "2026-06-20T10:00:00.000Z" }
    ]);
    expect(persistPlanRsvp).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxEvent: {
          aggregateType: "plan",
          aggregateId: "plan_1",
          eventName: "plan.rsvp_changed",
          eventVersion: 1,
          payload: {
            planId: "plan_1",
            memberId: "member_a",
            groupId: "group_1",
            status: "yes",
            allRequiredReceived: true
          }
        }
      })
    );
  });

  it("requires idempotency before recording RSVPs", async () => {
    await expect(
      planApi.handlePostPlanRsvp?.(
        { member, idempotencyKey: null },
        { planId: "plan_1" },
        { status: "yes" },
        {
          reserveIdempotencyKey: vi.fn(),
          loadPlanRsvpAccess: vi.fn(),
          now: () => new Date("2026-06-20T10:00:00.000Z"),
          persistPlanRsvp: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
