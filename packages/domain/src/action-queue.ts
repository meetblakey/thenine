import { DomainInvariantError } from "./group-eligibility.js";

export type ActionQueueTargetType = "verification" | "group" | "introduction" | "conversation" | "plan" | "debrief" | "safety";
export type ActionQueueActionKind =
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
export type ActionQueuePriority = "safety" | "deadline" | "standard";
export type ActionQueueStatus = "pending" | "completed" | "dismissed" | "expired";

export interface ActionQueueItemInput {
  itemId: string;
  memberId: string;
  groupId: string | null;
  sourceEventId: string | null;
  sourceEventName: string;
  targetType: ActionQueueTargetType;
  targetId: string;
  actionKind: ActionQueueActionKind;
  deadlineAt: string | null;
  dismissible: boolean;
  createdAt: string;
}

export interface ActionQueueItem {
  id: string;
  memberId: string;
  groupId: string | null;
  sourceEventId: string;
  sourceEventName: string;
  targetType: ActionQueueTargetType;
  targetId: string;
  actionKind: ActionQueueActionKind;
  priority: ActionQueuePriority;
  deadlineAt: string | null;
  status: ActionQueueStatus;
  dismissible: boolean;
  createdAt: string;
  dismissedAt?: string;
}

export interface ActionQueueItemCreatedEventDraft {
  aggregateType: "member";
  aggregateId: string;
  eventName: "action_queue.item_created";
  eventVersion: 1;
  payload: {
    itemId: string;
    memberId: string;
    groupId: string | null;
    sourceEventId: string;
    targetType: ActionQueueTargetType;
    targetId: string;
    actionKind: ActionQueueActionKind;
    deadlineAt: string | null;
  };
}

export interface ActionQueueItemCreatedResult {
  item: ActionQueueItem;
  outboxEvent: ActionQueueItemCreatedEventDraft;
}

export interface ActionQueueDismissalResult {
  item: ActionQueueItem & { status: "dismissed"; dismissedAt: string };
  outboxEvent: {
    aggregateType: "member";
    aggregateId: string;
    eventName: "action_queue.item_dismissed";
    eventVersion: 1;
    payload: { itemId: string; memberId: string; dismissedAt: string };
  };
}

const genericReengagementEvents = new Set(["session.reactivated", "session.opened", "engagement.reengagement_requested"]);
const priorityRank: Record<ActionQueuePriority, number> = {
  safety: 0,
  deadline: 1,
  standard: 2
};

export function buildActionQueueItem(input: ActionQueueItemInput): ActionQueueItemCreatedResult {
  if (input.sourceEventId === null || input.sourceEventId.trim() === "") {
    throw new DomainInvariantError("UNPROCESSABLE_STATE", "Action queue items require a persisted source event.");
  }

  if (genericReengagementEvents.has(input.sourceEventName)) {
    throw new DomainInvariantError("VALIDATION_ERROR", "Generic re-engagement events cannot create Momentum Hub actions.");
  }

  const item: ActionQueueItem = {
    id: input.itemId,
    memberId: input.memberId,
    groupId: input.groupId,
    sourceEventId: input.sourceEventId,
    sourceEventName: input.sourceEventName,
    targetType: input.targetType,
    targetId: input.targetId,
    actionKind: input.actionKind,
    priority: priorityFor(input),
    deadlineAt: input.deadlineAt,
    status: "pending",
    dismissible: input.dismissible,
    createdAt: input.createdAt
  };

  return {
    item,
    outboxEvent: {
      aggregateType: "member",
      aggregateId: input.memberId,
      eventName: "action_queue.item_created",
      eventVersion: 1,
      payload: {
        itemId: input.itemId,
        memberId: input.memberId,
        groupId: input.groupId,
        sourceEventId: input.sourceEventId,
        targetType: input.targetType,
        targetId: input.targetId,
        actionKind: input.actionKind,
        deadlineAt: input.deadlineAt
      }
    }
  };
}

export function orderActionQueueItems(items: ActionQueueItem[]): ActionQueueItem[] {
  return items
    .filter((item) => item.status === "pending")
    .sort((first, second) => {
      const priorityDifference = priorityRank[first.priority] - priorityRank[second.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const deadlineDifference = deadlineSortValue(first.deadlineAt) - deadlineSortValue(second.deadlineAt);

      if (deadlineDifference !== 0) {
        return deadlineDifference;
      }

      return first.createdAt.localeCompare(second.createdAt);
    });
}

export function dismissActionQueueItem(input: {
  item: ActionQueueItem;
  memberId: string;
  dismissedAt: string;
}): ActionQueueDismissalResult {
  if (input.item.memberId !== input.memberId) {
    throw new DomainInvariantError("FORBIDDEN", "Action queue items can only be dismissed by the owning member.");
  }

  if (input.item.status !== "pending") {
    throw new DomainInvariantError("CONFLICT", "Only pending action queue items can be dismissed.");
  }

  if (!input.item.dismissible) {
    throw new DomainInvariantError("UNPROCESSABLE_STATE", "This action queue item cannot be dismissed.");
  }

  return {
    item: {
      ...input.item,
      status: "dismissed",
      dismissedAt: input.dismissedAt
    },
    outboxEvent: {
      aggregateType: "member",
      aggregateId: input.memberId,
      eventName: "action_queue.item_dismissed",
      eventVersion: 1,
      payload: {
        itemId: input.item.id,
        memberId: input.memberId,
        dismissedAt: input.dismissedAt
      }
    }
  };
}

function priorityFor(input: ActionQueueItemInput): ActionQueuePriority {
  if (input.targetType === "safety" || input.actionKind === "review_safety_update" || input.sourceEventName.startsWith("safety.")) {
    return "safety";
  }

  return input.deadlineAt === null ? "standard" : "deadline";
}

function deadlineSortValue(deadlineAt: string | null): number {
  return deadlineAt === null ? Number.POSITIVE_INFINITY : Date.parse(deadlineAt);
}
