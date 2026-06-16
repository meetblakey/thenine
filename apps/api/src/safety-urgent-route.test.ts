import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";

interface AuthenticatedMember {
  memberId: string;
}

interface SafetyMutationContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

interface UrgentActionDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  assertUrgentActionAccess: (input: { memberId: string; groupId?: string; conversationId?: string; planId?: string }) => Promise<void>;
  nextActionId: () => string;
  now: () => Date;
  persistUrgentSafetyAction: (input: Record<string, unknown>) => Promise<{ actionId: string; status: "applied" | "queued"; guidance: string }>;
}

type SafetyApiExports = typeof api & {
  POST_SAFETY_URGENT_ACTION_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handlePostSafetyUrgentAction?: (
    context: SafetyMutationContext,
    body: { surface: string; groupId?: string; conversationId?: string; planId?: string; action: "share_plan" | "hide_me" | "leave_group" | "contact_support" },
    dependencies: UrgentActionDependencies
  ) => Promise<{ actionId: string; status: "applied" | "queued"; guidance: string }>;
};

const safetyApi = api as SafetyApiExports;
const member: AuthenticatedMember = {
  memberId: "member_a"
};

describe("urgent safety action API route", () => {
  it("publishes documented urgent action route metadata", () => {
    expect(safetyApi.POST_SAFETY_URGENT_ACTION_ROUTE).toEqual({
      method: "POST",
      path: "/v1/safety/urgent-actions",
      auth: "Member JWT",
      requiresIdempotencyKey: true
    });
  });

  it("persists urgent share-plan actions after access check", async () => {
    expect(safetyApi.handlePostSafetyUrgentAction).toBeTypeOf("function");

    const calls: string[] = [];
    const persistUrgentSafetyAction = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("persist-urgent-action");

      return input.response as { actionId: string; status: "applied" | "queued"; guidance: string };
    });

    const result = await safetyApi.handlePostSafetyUrgentAction?.(
      { member, idempotencyKey: "idem-urgent" },
      { surface: "plan", planId: "plan_1", action: "share_plan" },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        assertUrgentActionAccess: vi.fn(async () => {
          calls.push("access");
        }),
        nextActionId: () => "urgent_1",
        now: () => new Date("2026-06-22T12:20:00.000Z"),
        persistUrgentSafetyAction
      }
    );

    expect(calls).toEqual(["idempotency", "access", "persist-urgent-action"]);
    expect(result).toMatchObject({ actionId: "urgent_1", status: "queued" });
    expect(persistUrgentSafetyAction).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxEvent: {
          aggregateType: "safety",
          aggregateId: "urgent_1",
          eventName: "safety.protective_action_applied",
          eventVersion: 1,
          payload: {
            actionId: "urgent_1",
            actionType: "share_plan",
            targetType: "plan",
            targetId: "plan_1"
          }
        }
      })
    );
  });

  it("requires idempotency before urgent action writes", async () => {
    await expect(
      safetyApi.handlePostSafetyUrgentAction?.(
        { member, idempotencyKey: null },
        { surface: "plan", planId: "plan_1", action: "share_plan" },
        {
          reserveIdempotencyKey: vi.fn(),
          assertUrgentActionAccess: vi.fn(),
          nextActionId: () => "urgent_1",
          now: () => new Date("2026-06-22T12:20:00.000Z"),
          persistUrgentSafetyAction: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
