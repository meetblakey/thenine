import { ApiRouteError } from "./launchpad-route.js";
import type { PersonaWebhookDependencies } from "./verification-route.js";

export interface PersonaWebhookPostgresQueryResult<Row> {
  rows: Row[];
  rowCount: number;
}

export interface PersonaWebhookPostgresQueryExecutor {
  query: <Row = Record<string, unknown>>(
    statement: string,
    values: readonly unknown[]
  ) => Promise<PersonaWebhookPostgresQueryResult<Row>>;
}

export interface PersonaWebhookPostgresQueryClient extends PersonaWebhookPostgresQueryExecutor {
  transaction?: <Result>(
    callback: (transactionClient: PersonaWebhookPostgresQueryExecutor) => Promise<Result>
  ) => Promise<Result>;
}

export interface PersonaWebhookPostgresPersistenceConfig {
  queryClient: PersonaWebhookPostgresQueryClient;
  now: () => Date;
  generateId: (kind: "provider_webhook_event" | "domain_event_outbox") => string;
}

type PersonaWebhookPersistencePorts = Pick<
  PersonaWebhookDependencies,
  "reserveProviderWebhookEvent" | "loadVerificationCaseByInquiryId" | "persistVerificationTransition"
>;

interface VerificationCaseRow {
  id: string;
  member_id: string;
  status: string;
}

export function createPersonaWebhookPostgresPersistence(
  config: PersonaWebhookPostgresPersistenceConfig
): PersonaWebhookPersistencePorts {
  return {
    reserveProviderWebhookEvent: async ({ provider, eventId }) => {
      const receivedAt = config.now().toISOString();
      const result = await config.queryClient.query(
        `insert into provider_webhook_events (id, provider, provider_event_id, signature_verified_at, idempotency_key, created_at)
values ($1, $2, $3, $4, $5, $4)
on conflict (provider, provider_event_id) do nothing`,
        [
          config.generateId("provider_webhook_event"),
          provider,
          eventId,
          receivedAt,
          `${provider}:${eventId}`
        ]
      );

      if (result.rowCount !== 1) {
        throw new ApiRouteError("IDEMPOTENCY_CONFLICT", "Provider webhook event was already reserved.");
      }
    },
    loadVerificationCaseByInquiryId: async (inquiryId) => {
      const result = await config.queryClient.query<VerificationCaseRow>(
        `select id, member_id, status from verification_cases
where provider = 'persona' and provider_inquiry_id = $1
limit 1`,
        [inquiryId]
      );
      const row = result.rows[0];

      if (row === undefined) {
        throw new ApiRouteError("NOT_FOUND", "Verification case was not found for Persona inquiry.");
      }

      return {
        memberId: row.member_id,
        status: row.status as Awaited<ReturnType<PersonaWebhookDependencies["loadVerificationCaseByInquiryId"]>>["status"]
      };
    },
    persistVerificationTransition: async (transition) => {
      const persistAt = config.now().toISOString();
      const run = async (client: PersonaWebhookPostgresQueryExecutor): Promise<void> => {
        const verificationCaseUpdate = await client.query(
          `update verification_cases
set status = $1,
    failure_reason_code = $2,
    risk_flags = $3,
    verified_at = case when $1 = 'approved' then $4 else verified_at end,
    updated_at = $4
where provider = 'persona' and provider_inquiry_id = $5`,
          [
            transition.nextStatus,
            transition.failureReasonCode,
            transition.riskFlags,
            persistAt,
            transition.providerInquiryId
          ]
        );

        if (verificationCaseUpdate.rowCount !== 1) {
          throw new ApiRouteError("NOT_FOUND", "Verification case was not found for transition persistence.");
        }

        await client.query(
          `update members
set verification_status = $1,
    updated_at = $2
where id = $3`,
          [transition.nextStatus, persistAt, transition.memberId]
        );

        await client.query(
          `insert into domain_event_outbox (id, aggregate_type, aggregate_id, event_name, event_version, sequence_number, payload, created_at)
values (
  $1,
  $2,
  $3,
  $4,
  $5,
  (
    select coalesce(max(sequence_number), 0) + 1
    from domain_event_outbox
    where aggregate_type = $2 and aggregate_id = $3
  ),
  $6,
  $7
)`,
          [
            config.generateId("domain_event_outbox"),
            transition.outboxEvent.aggregateType,
            transition.outboxEvent.aggregateId,
            transition.outboxEvent.eventName,
            transition.outboxEvent.eventVersion,
            JSON.stringify(transition.outboxEvent.payload),
            persistAt
          ]
        );

        await client.query(
          `update provider_webhook_events
set processed_at = $1
where provider = $2 and provider_event_id = $3`,
          [persistAt, transition.provider, transition.providerEventId]
        );
      };

      if (config.queryClient.transaction !== undefined) {
        await config.queryClient.transaction(run);
        return;
      }

      await run(config.queryClient);
    }
  };
}
