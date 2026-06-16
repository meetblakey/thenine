import { describe, expect, it } from "vitest";
import type { VerificationStatus } from "@thenine/domain";
import * as api from "./index.js";

interface PersonaWebhookPostgresQueryResult<Row> {
  rows: Row[];
  rowCount: number;
}

interface PersonaWebhookPostgresQueryClient {
  query: <Row = Record<string, unknown>>(
    statement: string,
    values: readonly unknown[]
  ) => Promise<PersonaWebhookPostgresQueryResult<Row>>;
  transaction: <Result>(
    callback: (transactionClient: Omit<PersonaWebhookPostgresQueryClient, "transaction">) => Promise<Result>
  ) => Promise<Result>;
}

interface VerificationStateTransitionWithProviderMetadata {
  provider: "persona";
  providerEventId: string;
  providerInquiryId: string;
  memberId: string;
  previousStatus: VerificationStatus;
  nextStatus: VerificationStatus;
  failureReasonCode: string | null;
  riskFlags: string[];
  emitGroupEligibilityRecompute: boolean;
  outboxEvent: {
    aggregateType: "member";
    aggregateId: string;
    eventName: "verification.status_changed";
    eventVersion: 1;
    payload: {
      memberId: string;
      status: VerificationStatus;
      failureReasonCode: string | null;
    };
  };
}

type PersonaWebhookPostgresPersistence = {
  reserveProviderWebhookEvent: (input: { provider: "persona"; eventId: string; inquiryId: string }) => Promise<void>;
  loadVerificationCaseByInquiryId: (inquiryId: string) => Promise<{ memberId: string; status: VerificationStatus }>;
  persistVerificationTransition: (transition: VerificationStateTransitionWithProviderMetadata) => Promise<void>;
};

type PersonaWebhookPostgresApiExports = typeof api & {
  createPersonaWebhookPostgresPersistence?: (config: {
    queryClient: PersonaWebhookPostgresQueryClient;
    now: () => Date;
    generateId: (kind: "provider_webhook_event" | "domain_event_outbox") => string;
  }) => PersonaWebhookPostgresPersistence;
};

const personaWebhookPostgresApi = api as PersonaWebhookPostgresApiExports;

describe("Persona webhook Postgres persistence", () => {
  it("reserves provider replay keys and persists verification transitions transactionally without raw provider payloads", async () => {
    expect(personaWebhookPostgresApi.createPersonaWebhookPostgresPersistence).toBeTypeOf("function");

    const executedStatements: Array<{ statement: string; values: readonly unknown[] }> = [];
    let transactionCount = 0;
    const query: PersonaWebhookPostgresQueryClient["query"] = async <Row = Record<string, unknown>>(
      statement: string,
      values: readonly unknown[]
    ): Promise<PersonaWebhookPostgresQueryResult<Row>> => {
      executedStatements.push({ statement, values });

      if (statement.includes("select id, member_id, status from verification_cases")) {
        return {
          rows: [{ id: "verification_case_1", member_id: "member_1", status: "pending" }] as Row[],
          rowCount: 1
        };
      }

      return { rows: [], rowCount: 1 };
    };
    const transaction: PersonaWebhookPostgresQueryClient["transaction"] = async (callback) => {
      transactionCount += 1;
      return callback({ query });
    };

    const persistence = personaWebhookPostgresApi.createPersonaWebhookPostgresPersistence?.({
      queryClient: { query, transaction },
      now: () => new Date("2027-06-16T10:20:00.000Z"),
      generateId: (kind) => `${kind}_id_1`
    });

    await persistence?.reserveProviderWebhookEvent({
      provider: "persona",
      eventId: "persona_event_db_1",
      inquiryId: "inq_db_1"
    });
    await expect(persistence?.loadVerificationCaseByInquiryId("inq_db_1")).resolves.toEqual({
      memberId: "member_1",
      status: "pending"
    });
    await persistence?.persistVerificationTransition({
      provider: "persona",
      providerEventId: "persona_event_db_1",
      providerInquiryId: "inq_db_1",
      memberId: "member_1",
      previousStatus: "pending",
      nextStatus: "approved",
      failureReasonCode: null,
      riskFlags: ["document_verified"],
      emitGroupEligibilityRecompute: true,
      outboxEvent: {
        aggregateType: "member",
        aggregateId: "member_1",
        eventName: "verification.status_changed",
        eventVersion: 1,
        payload: {
          memberId: "member_1",
          status: "approved",
          failureReasonCode: null
        }
      }
    });

    expect(transactionCount).toBe(1);
    expect(executedStatements.map(({ statement }) => statement)).toEqual([
      expect.stringContaining("insert into provider_webhook_events"),
      expect.stringContaining("select id, member_id, status from verification_cases"),
      expect.stringContaining("update verification_cases"),
      expect.stringContaining("update members"),
      expect.stringContaining("insert into domain_event_outbox"),
      expect.stringContaining("update provider_webhook_events")
    ]);
    expect(executedStatements[0]?.values).toEqual([
      "provider_webhook_event_id_1",
      "persona",
      "persona_event_db_1",
      "2027-06-16T10:20:00.000Z",
      "persona:persona_event_db_1"
    ]);
    expect(JSON.stringify(executedStatements)).not.toMatch(/documentImage|government|liveness|selfie|raw-provider-artifact/i);
  });
});
