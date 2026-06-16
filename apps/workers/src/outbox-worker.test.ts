import { describe, expect, it, vi } from "vitest";
import * as workers from "./index.js";

interface OutboxRow {
  id: string;
  eventName: string;
  eventVersion: number;
  aggregateType: "member" | "group" | "introduction" | "conversation" | "plan" | "debrief" | "safety" | "purchase";
  aggregateId: string;
  sequenceNumber: number;
  occurredAt: string;
  payload: Record<string, unknown>;
}

interface NotificationDecision {
  sourceEventId: string;
  shouldNotify: boolean;
  category: string | null;
  templateKey: string | null;
  targetPath: string | null;
  dedupeKey: string | null;
  sendAfter: string | null;
  privacyLevel: "private" | "contextual" | "full";
}

interface OutboxDependencies {
  loadUnpublishedEvents: (limit: number) => Promise<OutboxRow[]>;
  publishRealtimeEvent: (event: OutboxRow) => Promise<void>;
  decideNotification: (event: OutboxRow) => Promise<NotificationDecision | null>;
  persistNotificationIntent: (decision: NotificationDecision) => Promise<void>;
  markEventPublished: (eventId: string) => Promise<void>;
  recordDeliveryFailure: (eventId: string, error: Error) => Promise<void>;
}

type WorkerExports = typeof workers & {
  processOutboxBatch?: (dependencies: OutboxDependencies, options?: { limit?: number }) => Promise<{ processed: number; failed: number }>;
};

const workerApi = workers as WorkerExports;

const messageEvent = (): OutboxRow => ({
  id: "event_1",
  eventName: "conversation.message_created",
  eventVersion: 1,
  aggregateType: "conversation",
  aggregateId: "conversation_1",
  sequenceNumber: 7,
  occurredAt: "2026-06-22T12:30:00.000Z",
  payload: { message: { id: "message_1" } }
});

describe("outbox worker", () => {
  it("publishes realtime, persists source-event notification intents, then marks the event published", async () => {
    expect(workerApi.processOutboxBatch).toBeTypeOf("function");

    const calls: string[] = [];
    const result = await workerApi.processOutboxBatch?.(
      {
        loadUnpublishedEvents: vi.fn(async () => [messageEvent()]),
        publishRealtimeEvent: vi.fn(async () => {
          calls.push("publish-realtime");
        }),
        decideNotification: vi.fn(async (event: OutboxRow) => {
          calls.push("decide-notification");

          return {
            sourceEventId: event.id,
            shouldNotify: true,
            category: "chat",
            templateKey: "chat_message_new",
            targetPath: "/conversations/conversation_1",
            dedupeKey: "conversation_1:member_a",
            sendAfter: null,
            privacyLevel: "private" as const
          };
        }),
        persistNotificationIntent: vi.fn(async (decision: NotificationDecision) => {
          calls.push(`persist-notification:${decision.sourceEventId}`);
        }),
        markEventPublished: vi.fn(async () => {
          calls.push("mark-published");
        }),
        recordDeliveryFailure: vi.fn()
      },
      { limit: 10 }
    );

    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(calls).toEqual(["publish-realtime", "decide-notification", "persist-notification:event_1", "mark-published"]);
  });

  it("does not mark an outbox event published if realtime delivery fails", async () => {
    expect(workerApi.processOutboxBatch).toBeTypeOf("function");

    const markEventPublished = vi.fn();
    const recordDeliveryFailure = vi.fn(async () => undefined);
    const result = await workerApi.processOutboxBatch?.({
      loadUnpublishedEvents: vi.fn(async () => [messageEvent()]),
      publishRealtimeEvent: vi.fn(async () => {
        throw new Error("ably unavailable");
      }),
      decideNotification: vi.fn(),
      persistNotificationIntent: vi.fn(),
      markEventPublished,
      recordDeliveryFailure
    });

    expect(result).toEqual({ processed: 0, failed: 1 });
    expect(markEventPublished).not.toHaveBeenCalled();
    expect(recordDeliveryFailure).toHaveBeenCalledWith("event_1", expect.any(Error));
  });

  it("rejects notification decisions that are not tied to the current source event", async () => {
    expect(workerApi.processOutboxBatch).toBeTypeOf("function");

    const markEventPublished = vi.fn();
    const result = await workerApi.processOutboxBatch?.({
      loadUnpublishedEvents: vi.fn(async () => [messageEvent()]),
      publishRealtimeEvent: vi.fn(async () => undefined),
      decideNotification: vi.fn(async () => ({
        sourceEventId: "different_event",
        shouldNotify: true,
        category: "chat",
        templateKey: "chat_message_new",
        targetPath: "/conversations/conversation_1",
        dedupeKey: "conversation_1:member_a",
        sendAfter: null,
        privacyLevel: "private" as const
      })),
      persistNotificationIntent: vi.fn(),
      markEventPublished,
      recordDeliveryFailure: vi.fn(async () => undefined)
    });

    expect(result).toEqual({ processed: 0, failed: 1 });
    expect(markEventPublished).not.toHaveBeenCalled();
  });
});
