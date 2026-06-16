import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";

interface AuthenticatedMember {
  memberId: string;
}

interface ActionQueueContext {
  member: AuthenticatedMember | null;
  idempotencyKey?: string | null;
}

interface ActionQueueItem {
  id: string;
  memberId: string;
  groupId: string | null;
  sourceEventId: string;
  sourceEventName: string;
  targetType: string;
  targetId: string;
  actionKind: string;
  priority: "safety" | "deadline" | "standard";
  deadlineAt: string | null;
  status: "pending" | "completed" | "dismissed" | "expired";
  dismissible: boolean;
  createdAt: string;
}

type ActionQueueApiExports = typeof api & {
  GET_ACTION_QUEUE_ROUTE?: {
    method: string;
    path: string;
    auth: string;
  };
  POST_ACTION_QUEUE_DISMISS_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handleGetActionQueue?: (
    context: ActionQueueContext,
    dependencies: { loadActionQueueItems: (memberId: string) => Promise<ActionQueueItem[]> }
  ) => Promise<{ items: ActionQueueItem[] }>;
  handlePostActionQueueDismiss?: (
    context: ActionQueueContext,
    params: { itemId: string },
    dependencies: {
      reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
      loadActionQueueItem: (itemId: string, memberId: string) => Promise<ActionQueueItem>;
      now: () => Date;
      persistActionQueueDismissal: (input: Record<string, unknown>) => Promise<{ item: ActionQueueItem }>;
    }
  ) => Promise<{ item: ActionQueueItem }>;
};

const actionQueueApi = api as ActionQueueApiExports;
const member = { memberId: "member_1" };

const item = (overrides: Partial<ActionQueueItem> = {}): ActionQueueItem => ({
  id: "action_1",
  memberId: "member_1",
  groupId: "group_1",
  sourceEventId: "event_1",
  sourceEventName: "plan.rsvp_changed",
  targetType: "plan",
  targetId: "plan_1",
  actionKind: "rsvp_plan",
  priority: "deadline",
  deadlineAt: "2026-06-22T08:00:00.000Z",
  status: "pending",
  dismissible: false,
  createdAt: "2026-06-21T08:00:00.000Z",
  ...overrides
});

describe("Action queue API routes", () => {
  it("publishes Momentum Hub route metadata", () => {
    expect(actionQueueApi.GET_ACTION_QUEUE_ROUTE).toEqual({
      method: "GET",
      path: "/v1/action-queue",
      auth: "Member JWT"
    });
    expect(actionQueueApi.POST_ACTION_QUEUE_DISMISS_ROUTE).toEqual({
      method: "POST",
      path: "/v1/action-queue/{itemId}/dismiss",
      auth: "Member JWT",
      requiresIdempotencyKey: true
    });
  });

  it("returns only pending persisted actions ordered by the domain resolver", async () => {
    expect(actionQueueApi.handleGetActionQueue).toBeTypeOf("function");

    const result = await actionQueueApi.handleGetActionQueue?.(
      { member },
      {
        loadActionQueueItems: vi.fn(async () => [
          item({ id: "done", status: "completed" }),
          item({
            id: "safety",
            sourceEventId: "event_safety",
            sourceEventName: "safety.protective_action_applied",
            targetType: "safety",
            targetId: "case_1",
            actionKind: "review_safety_update",
            priority: "safety",
            deadlineAt: null
          }),
          item({ id: "rsvp", sourceEventId: "event_rsvp", targetId: "plan_1" })
        ])
      }
    );

    expect(result?.items.map((queueItem) => queueItem.id)).toEqual(["safety", "rsvp"]);
    expect(JSON.stringify(result)).not.toMatch(/come back|people are active|session_reactivated/i);
  });

  it("dismisses only persisted queue items through an idempotent mutation", async () => {
    expect(actionQueueApi.handlePostActionQueueDismiss).toBeTypeOf("function");

    const calls: string[] = [];
    const dismissibleItem = item({
      id: "info_1",
      sourceEventName: "debrief.mutual_edge_revealed",
      targetType: "debrief",
      targetId: "edge_1",
      actionKind: "view_mutual_result",
      priority: "standard",
      deadlineAt: null,
      dismissible: true
    });
    const persistActionQueueDismissal = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("persist-dismissal");

      return { item: (input as { item: ActionQueueItem }).item };
    });

    const result = await actionQueueApi.handlePostActionQueueDismiss?.(
      { member, idempotencyKey: "idem-dismiss" },
      { itemId: "info_1" },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        loadActionQueueItem: vi.fn(async () => {
          calls.push("load-item");

          return dismissibleItem;
        }),
        now: () => new Date("2026-06-22T10:00:00.000Z"),
        persistActionQueueDismissal
      }
    );

    expect(calls).toEqual(["idempotency", "load-item", "persist-dismissal"]);
    expect(result).toEqual({
      item: {
        ...dismissibleItem,
        status: "dismissed",
        dismissedAt: "2026-06-22T10:00:00.000Z"
      }
    });
    expect(persistActionQueueDismissal).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxEvent: expect.objectContaining({
          eventName: "action_queue.item_dismissed",
          payload: { itemId: "info_1", memberId: "member_1", dismissedAt: "2026-06-22T10:00:00.000Z" }
        })
      })
    );
  });

  it("requires idempotency before dismissing queue items", async () => {
    await expect(
      actionQueueApi.handlePostActionQueueDismiss?.(
        { member, idempotencyKey: null },
        { itemId: "info_1" },
        {
          reserveIdempotencyKey: vi.fn(),
          loadActionQueueItem: vi.fn(),
          now: () => new Date("2026-06-22T10:00:00.000Z"),
          persistActionQueueDismissal: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
