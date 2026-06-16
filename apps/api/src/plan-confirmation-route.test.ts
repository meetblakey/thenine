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

interface PlanConfirmationDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadPlanConfirmationAccess: (
    planId: string,
    memberId: string
  ) => Promise<{ plan: PlanResource; requiredMemberIds: string[] }>;
  now: () => Date;
  persistPlanConfirmation: (input: Record<string, unknown>) => Promise<PlanResource>;
}

type PlanApiExports = typeof api & {
  POST_PLAN_CONFIRM_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handlePostPlanConfirm?: (
    context: PlanMutationContext,
    params: { planId: string },
    body: { selectedOptionId?: string },
    dependencies: PlanConfirmationDependencies
  ) => Promise<PlanResource>;
};

const planApi = api as PlanApiExports;
const member: AuthenticatedMember = {
  memberId: "member_a"
};

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
  rsvps: [{ memberId: "member_a", groupId: "group_1", status: "yes", respondedAt: "2026-06-20T10:00:00.000Z" }]
});

describe("Plan confirmation API route", () => {
  it("publishes documented Plan confirmation route metadata", () => {
    expect(planApi.POST_PLAN_CONFIRM_ROUTE).toEqual({
      method: "POST",
      path: "/v1/plans/{planId}/confirm",
      auth: "Plan participant",
      requiresIdempotencyKey: true
    });
  });

  it("persists Plan confirmation with a plan.confirmed outbox event", async () => {
    expect(planApi.handlePostPlanConfirm).toBeTypeOf("function");

    const calls: string[] = [];
    const persistPlanConfirmation = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("persist-confirmation-with-outbox");

      return input.plan as PlanResource;
    });

    const result = await planApi.handlePostPlanConfirm?.(
      { member, idempotencyKey: "idem-confirm" },
      { planId: "plan_1" },
      {},
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        loadPlanConfirmationAccess: vi.fn(async () => {
          calls.push("access");

          return { plan: confirmablePlan(), requiredMemberIds: ["member_a"] };
        }),
        now: () => new Date("2026-06-20T10:05:00.000Z"),
        persistPlanConfirmation
      }
    );

    expect(calls).toEqual(["idempotency", "access", "persist-confirmation-with-outbox"]);
    expect(result?.status).toBe("confirmed");
    expect(persistPlanConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxEvent: {
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
        }
      })
    );
  });

  it("requires idempotency before confirming Plans", async () => {
    await expect(
      planApi.handlePostPlanConfirm?.(
        { member, idempotencyKey: null },
        { planId: "plan_1" },
        {},
        {
          reserveIdempotencyKey: vi.fn(),
          loadPlanConfirmationAccess: vi.fn(),
          now: () => new Date("2026-06-20T10:05:00.000Z"),
          persistPlanConfirmation: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
