import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
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

type RuntimeApiExports = typeof api & {
  createApiFastifyAppFromRuntimeConfig?: (config: {
    env: Record<string, string | undefined>;
    queryClient: PersonaWebhookPostgresQueryClient;
    now: () => Date;
    signatureNow: () => number;
    generateId: (kind: "provider_webhook_event" | "domain_event_outbox") => string;
  }) => Promise<FastifyInstance>;
};

const runtimeApi = api as RuntimeApiExports;

describe("API runtime composition", () => {
  it("wires environment-managed Persona webhook secrets to Postgres-backed webhook persistence", async () => {
    const createApp = runtimeApi.createApiFastifyAppFromRuntimeConfig;
    expect(createApp).toBeTypeOf("function");
    if (createApp === undefined) {
      return;
    }

    const timestamp = 1_813_230_000;
    const webhookSecret = "whsec_runtime";
    const rawBody =
      '{"id":"persona_event_runtime_1","createdAt":"2027-06-16T11:00:00.000Z","data":{"inquiryId":"inq_runtime_1","status":"approved","documentImage":"raw-provider-artifact"}}';
    const digest = createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
    const executedStatements: Array<{ statement: string; values: readonly unknown[] }> = [];
    let transactionCount = 0;
    const query: PersonaWebhookPostgresQueryClient["query"] = async <Row = Record<string, unknown>>(
      statement: string,
      values: readonly unknown[]
    ): Promise<PersonaWebhookPostgresQueryResult<Row>> => {
      executedStatements.push({ statement, values });

      if (statement.includes("select id, member_id, status from verification_cases")) {
        return {
          rows: [{ id: "verification_case_runtime_1", member_id: "member_runtime_1", status: "pending" }] as Row[],
          rowCount: 1
        };
      }

      return { rows: [], rowCount: 1 };
    };
    const transaction: PersonaWebhookPostgresQueryClient["transaction"] = async (callback) => {
      transactionCount += 1;
      return callback({ query });
    };

    const app = await createApp({
      env: {
        PERSONA_WEBHOOK_SECRET: webhookSecret
      },
      queryClient: { query, transaction },
      now: () => new Date("2027-06-16T11:05:00.000Z"),
      signatureNow: () => timestamp,
      generateId: (kind) => `${kind}_runtime_1`
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/webhooks/persona",
      headers: {
        "content-type": "application/json",
        "persona-signature": `t=${timestamp},v1=${digest}`
      },
      payload: rawBody
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });
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
      "provider_webhook_event_runtime_1",
      "persona",
      "persona_event_runtime_1",
      "2027-06-16T11:05:00.000Z",
      "persona:persona_event_runtime_1"
    ]);
    expect(JSON.stringify(executedStatements)).not.toMatch(/raw-provider-artifact|documentImage|government|liveness|selfie/i);

    await app.close();
  });

  it("fails closed when the Persona webhook secret is not configured", async () => {
    const createApp = runtimeApi.createApiFastifyAppFromRuntimeConfig;
    expect(createApp).toBeTypeOf("function");
    if (createApp === undefined) {
      return;
    }

    const queryClient: PersonaWebhookPostgresQueryClient = {
      query: async <Row = Record<string, unknown>>(): Promise<PersonaWebhookPostgresQueryResult<Row>> => ({
        rows: [],
        rowCount: 0
      }),
      transaction: async (callback) => callback({ query: queryClient.query })
    };

    await expect(
      createApp({
        env: {},
        queryClient,
        now: () => new Date("2027-06-16T11:05:00.000Z"),
        signatureNow: () => 1_813_230_000,
        generateId: (kind) => `${kind}_runtime_1`
      })
    ).rejects.toThrow("PERSONA_WEBHOOK_SECRET is required.");
  });
});
