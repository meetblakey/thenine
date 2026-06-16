export interface OutboxEventRow {
  id: string;
  eventName: string;
  eventVersion: number;
  aggregateType: "member" | "group" | "introduction" | "conversation" | "plan" | "debrief" | "safety" | "purchase";
  aggregateId: string;
  sequenceNumber: number;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface NotificationDecision {
  sourceEventId: string;
  shouldNotify: boolean;
  category: string | null;
  templateKey: string | null;
  targetPath: string | null;
  dedupeKey: string | null;
  sendAfter: string | null;
  privacyLevel: "private" | "contextual" | "full";
}

export interface OutboxWorkerDependencies {
  loadUnpublishedEvents: (limit: number) => Promise<OutboxEventRow[]>;
  publishRealtimeEvent: (event: OutboxEventRow) => Promise<void>;
  decideNotification: (event: OutboxEventRow) => Promise<NotificationDecision | null>;
  persistNotificationIntent: (decision: NotificationDecision) => Promise<void>;
  markEventPublished: (eventId: string) => Promise<void>;
  recordDeliveryFailure: (eventId: string, error: Error) => Promise<void>;
}

export interface OutboxBatchOptions {
  limit?: number;
}

export interface OutboxBatchResult {
  processed: number;
  failed: number;
}

export async function processOutboxBatch(
  dependencies: OutboxWorkerDependencies,
  options: OutboxBatchOptions = {}
): Promise<OutboxBatchResult> {
  const events = await dependencies.loadUnpublishedEvents(options.limit ?? 100);
  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      await dependencies.publishRealtimeEvent(event);

      const decision = await dependencies.decideNotification(event);

      if (decision !== null && decision.shouldNotify) {
        if (decision.sourceEventId !== event.id) {
          throw new Error("Notification decision sourceEventId must match the persisted outbox event.");
        }

        await dependencies.persistNotificationIntent(decision);
      }

      await dependencies.markEventPublished(event.id);
      processed += 1;
    } catch (error) {
      failed += 1;
      await dependencies.recordDeliveryFailure(event.id, error instanceof Error ? error : new Error("Unknown outbox delivery failure."));
    }
  }

  return { processed, failed };
}
