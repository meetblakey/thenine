import { dismissActionQueueItem, orderActionQueueItems } from "@thenine/domain";
import { DomainInvariantError } from "@thenine/domain/group-eligibility";
import type { ActionQueueDismissalResult, ActionQueueItem } from "@thenine/domain";
import { ApiRouteError } from "./launchpad-route.js";
import type { ApiErrorCode } from "./launchpad-route.js";

export const GET_ACTION_QUEUE_ROUTE = {
  method: "GET",
  path: "/v1/action-queue",
  auth: "Member JWT"
} as const;

export const POST_ACTION_QUEUE_DISMISS_ROUTE = {
  method: "POST",
  path: "/v1/action-queue/{itemId}/dismiss",
  auth: "Member JWT",
  requiresIdempotencyKey: true
} as const;

export interface ActionQueueRouteMember {
  memberId: string;
}

export interface ActionQueueRequestContext {
  member: ActionQueueRouteMember | null;
  idempotencyKey?: string | null;
}

export interface GetActionQueueDependencies {
  loadActionQueueItems: (memberId: string) => Promise<ActionQueueItem[]>;
}

export interface DismissActionQueueDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadActionQueueItem: (itemId: string, memberId: string) => Promise<ActionQueueItem>;
  now: () => Date;
  persistActionQueueDismissal: (input: ActionQueueDismissalResult) => Promise<{ item: ActionQueueDismissalResult["item"] }>;
}

export async function handleGetActionQueue(
  context: ActionQueueRequestContext,
  dependencies: GetActionQueueDependencies
): Promise<{ items: ActionQueueItem[] }> {
  const member = requireActionQueueMember(context.member);
  const items = await dependencies.loadActionQueueItems(member.memberId);

  return {
    items: orderActionQueueItems(items)
  };
}

export async function handlePostActionQueueDismiss(
  context: ActionQueueRequestContext,
  params: { itemId: string },
  dependencies: DismissActionQueueDependencies
): Promise<{ item: ActionQueueDismissalResult["item"] }> {
  const member = requireActionQueueMember(context.member);
  await reserveRequiredActionQueueIdempotency(context, dependencies.reserveIdempotencyKey);

  try {
    const item = await dependencies.loadActionQueueItem(params.itemId, member.memberId);
    const dismissal = dismissActionQueueItem({
      item,
      memberId: member.memberId,
      dismissedAt: dependencies.now().toISOString()
    });

    return await dependencies.persistActionQueueDismissal(dismissal);
  } catch (error) {
    throw mapActionQueueDomainError(error);
  }
}

function requireActionQueueMember(member: ActionQueueRouteMember | null): ActionQueueRouteMember {
  if (member === null) {
    throw new ApiRouteError("UNAUTHENTICATED", "Action queue routes require a member session.");
  }

  return member;
}

async function reserveRequiredActionQueueIdempotency(
  context: ActionQueueRequestContext,
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>
): Promise<void> {
  if (context.idempotencyKey === undefined || context.idempotencyKey === null || context.idempotencyKey.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Mutating routes require Idempotency-Key.");
  }

  const member = requireActionQueueMember(context.member);
  await reserveIdempotencyKey(
    `${POST_ACTION_QUEUE_DISMISS_ROUTE.method} ${POST_ACTION_QUEUE_DISMISS_ROUTE.path}`,
    context.idempotencyKey,
    member.memberId
  );
}

function mapActionQueueDomainError(error: unknown): Error {
  if (error instanceof DomainInvariantError) {
    return new ApiRouteError(error.code as ApiErrorCode, error.message);
  }

  return error instanceof Error ? error : new ApiRouteError("UNPROCESSABLE_STATE", "Unexpected action queue route failure.");
}
