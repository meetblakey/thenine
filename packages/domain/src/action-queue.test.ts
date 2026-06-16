import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

interface ActionQueueItemInput {
  itemId: string;
  memberId: string;
  groupId: string | null;
  sourceEventId: string | null;
  sourceEventName: string;
  targetType: "verification" | "group" | "introduction" | "conversation" | "plan" | "debrief" | "safety";
  targetId: string;
  actionKind:
    | "verify_identity"
    | "invite_friend"
    | "approve_publish"
    | "approve_introduction"
    | "reply_to_chat"
    | "vote_plan"
    | "rsvp_plan"
    | "review_safety_update"
    | "confirm_attendance"
    | "submit_debrief"
    | "view_mutual_result";
  deadlineAt: string | null;
  dismissible: boolean;
  createdAt: string;
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

type ActionQueueDomainExports = typeof domain & {
  buildActionQueueItem?: (input: ActionQueueItemInput) => {
    item: ActionQueueItem;
    outboxEvent: {
      aggregateType: "member";
      aggregateId: string;
      eventName: "action_queue.item_created";
      eventVersion: 1;
      payload: {
        itemId: string;
        memberId: string;
        groupId: string | null;
        sourceEventId: string;
        targetType: string;
        targetId: string;
        actionKind: string;
        deadlineAt: string | null;
      };
    };
  };
  orderActionQueueItems?: (items: ActionQueueItem[]) => ActionQueueItem[];
  dismissActionQueueItem?: (input: { item: ActionQueueItem; memberId: string; dismissedAt: string }) => {
    item: ActionQueueItem & { status: "dismissed"; dismissedAt: string };
    outboxEvent: {
      aggregateType: "member";
      aggregateId: string;
      eventName: "action_queue.item_dismissed";
      eventVersion: 1;
      payload: { itemId: string; memberId: string; dismissedAt: string };
    };
  };
};

const actionQueueDomain = domain as ActionQueueDomainExports;

const input = (overrides: Partial<ActionQueueItemInput> = {}): ActionQueueItemInput => ({
  itemId: "action_1",
  memberId: "member_1",
  groupId: "group_1",
  sourceEventId: "event_1",
  sourceEventName: "plan.rsvp_changed",
  targetType: "plan",
  targetId: "plan_1",
  actionKind: "rsvp_plan",
  deadlineAt: "2026-06-22T08:00:00.000Z",
  dismissible: false,
  createdAt: "2026-06-21T08:00:00.000Z",
  ...overrides
});

describe("action queue domain", () => {
  it("creates only persisted source-event-backed action items", () => {
    expect(actionQueueDomain.buildActionQueueItem).toBeTypeOf("function");

    const result = actionQueueDomain.buildActionQueueItem?.(input());

    expect(result?.item).toEqual({
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
      createdAt: "2026-06-21T08:00:00.000Z"
    });
    expect(result?.outboxEvent).toEqual({
      aggregateType: "member",
      aggregateId: "member_1",
      eventName: "action_queue.item_created",
      eventVersion: 1,
      payload: {
        itemId: "action_1",
        memberId: "member_1",
        groupId: "group_1",
        sourceEventId: "event_1",
        targetType: "plan",
        targetId: "plan_1",
        actionKind: "rsvp_plan",
        deadlineAt: "2026-06-22T08:00:00.000Z"
      }
    });
  });

  it("rejects generic re-engagement and missing source events", () => {
    expect(actionQueueDomain.buildActionQueueItem).toBeTypeOf("function");

    expect(() => actionQueueDomain.buildActionQueueItem?.(input({ sourceEventId: null }))).toThrow(/source event/i);
    expect(() =>
      actionQueueDomain.buildActionQueueItem?.(
        input({
          sourceEventName: "session.reactivated",
          actionKind: "reply_to_chat",
          targetType: "conversation",
          targetId: "conversation_1"
        })
      )
    ).toThrow(/generic re-engagement/i);
  });

  it("orders safety first, then pending deadlines, and removes completed items", () => {
    expect(actionQueueDomain.orderActionQueueItems).toBeTypeOf("function");

    const items: ActionQueueItem[] = [
      {
        ...actionQueueDomain.buildActionQueueItem?.(
          input({ itemId: "done", sourceEventId: "event_done", targetId: "plan_done" })
        )?.item,
        status: "completed"
      } as ActionQueueItem,
      actionQueueDomain.buildActionQueueItem?.(
        input({ itemId: "later", sourceEventId: "event_later", targetId: "plan_later", deadlineAt: "2026-06-23T08:00:00.000Z" })
      )?.item as ActionQueueItem,
      actionQueueDomain.buildActionQueueItem?.(
        input({
          itemId: "safety",
          sourceEventId: "event_safety",
          sourceEventName: "safety.protective_action_applied",
          targetType: "safety",
          targetId: "case_1",
          actionKind: "review_safety_update",
          deadlineAt: null
        })
      )?.item as ActionQueueItem,
      actionQueueDomain.buildActionQueueItem?.(
        input({ itemId: "soon", sourceEventId: "event_soon", targetId: "plan_soon", deadlineAt: "2026-06-22T08:00:00.000Z" })
      )?.item as ActionQueueItem
    ];

    expect(actionQueueDomain.orderActionQueueItems?.(items).map((item) => item.id)).toEqual(["safety", "soon", "later"]);
  });

  it("allows dismissing only policy-dismissible pending items owned by the member", () => {
    expect(actionQueueDomain.dismissActionQueueItem).toBeTypeOf("function");

    const item = actionQueueDomain.buildActionQueueItem?.(
      input({ itemId: "info_1", actionKind: "view_mutual_result", targetType: "debrief", targetId: "edge_1", dismissible: true, deadlineAt: null })
    )?.item as ActionQueueItem;

    expect(
      actionQueueDomain.dismissActionQueueItem?.({
        item,
        memberId: "member_1",
        dismissedAt: "2026-06-22T10:00:00.000Z"
      })
    ).toEqual({
      item: {
        ...item,
        status: "dismissed",
        dismissedAt: "2026-06-22T10:00:00.000Z"
      },
      outboxEvent: {
        aggregateType: "member",
        aggregateId: "member_1",
        eventName: "action_queue.item_dismissed",
        eventVersion: 1,
        payload: { itemId: "info_1", memberId: "member_1", dismissedAt: "2026-06-22T10:00:00.000Z" }
      }
    });
    expect(() =>
      actionQueueDomain.dismissActionQueueItem?.({
        item: actionQueueDomain.buildActionQueueItem?.(input({ dismissible: false }))?.item as ActionQueueItem,
        memberId: "member_1",
        dismissedAt: "2026-06-22T10:00:00.000Z"
      })
    ).toThrow(/cannot be dismissed/i);
  });
});
