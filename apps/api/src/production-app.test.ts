import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import * as api from "./index.js";

interface NodePostgresQueryResult<Row> {
  rows: Row[];
  rowCount: number | null;
}

interface NodePostgresQueryExecutor {
  query: <Row = Record<string, unknown>>(
    statement: string,
    values?: readonly unknown[]
  ) => Promise<NodePostgresQueryResult<Row>>;
}

interface NodePostgresClient extends NodePostgresQueryExecutor {
  release: () => void;
}

interface NodePostgresPool extends NodePostgresQueryExecutor {
  connect: () => Promise<NodePostgresClient>;
  end: () => Promise<void>;
}

interface NodePostgresPoolConfig {
  connectionString: string;
}

type ProductionAppApiExports = typeof api & {
  createApiProductionApp?: (config: {
    env: Record<string, string | undefined>;
    createPostgresPool: (config: NodePostgresPoolConfig) => NodePostgresPool;
    now: () => Date;
    signatureNow: () => number;
  }) => Promise<FastifyInstance>;
};

const productionAppApi = api as ProductionAppApiExports;
const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("API production app composition", () => {
  it("passes resolved secrets and a production Postgres pool into the runtime app", async () => {
    const createApp = productionAppApi.createApiProductionApp;
    expect(createApp).toBeTypeOf("function");
    if (createApp === undefined) {
      return;
    }

    const timestamp = 1_813_233_600;
    const webhookSecret = "whsec_production";
    const rawBody =
      '{"id":"persona_event_production_1","createdAt":"2027-06-16T12:00:00.000Z","data":{"inquiryId":"inq_production_1","status":"approved","documentImage":"raw-provider-artifact"}}';
    const digest = createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
    const poolStatements: Array<{ statement: string; values: readonly unknown[] | undefined }> = [];
    const transactionStatements: Array<{ statement: string; values: readonly unknown[] | undefined }> = [];
    const createdPools: NodePostgresPoolConfig[] = [];
    let poolEndCount = 0;
    let releaseCount = 0;
    const transactionClient: NodePostgresClient = {
      query: async <Row = Record<string, unknown>>(
        statement: string,
        values?: readonly unknown[]
      ): Promise<NodePostgresQueryResult<Row>> => {
        transactionStatements.push({ statement, values });
        return { rows: [] as Row[], rowCount: 1 };
      },
      release: () => {
        releaseCount += 1;
      }
    };
    const pool: NodePostgresPool = {
      query: async <Row = Record<string, unknown>>(
        statement: string,
        values?: readonly unknown[]
      ): Promise<NodePostgresQueryResult<Row>> => {
        poolStatements.push({ statement, values });

        if (statement.includes("select id, member_id, status from verification_cases")) {
          return {
            rows: [{ id: "verification_case_production_1", member_id: "member_production_1", status: "pending" }] as Row[],
            rowCount: 1
          };
        }

        return { rows: [] as Row[], rowCount: 1 };
      },
      connect: async () => transactionClient,
      end: async () => {
        poolEndCount += 1;
      }
    };

    const app = await createApp({
      env: {
        DATABASE_URL: "postgres://production-db.example/the-nine",
        PERSONA_WEBHOOK_SECRET: webhookSecret
      },
      createPostgresPool: (poolConfig) => {
        createdPools.push(poolConfig);
        return pool;
      },
      now: () => new Date("2027-06-16T12:05:00.000Z"),
      signatureNow: () => timestamp
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
    expect(createdPools).toEqual([{ connectionString: "postgres://production-db.example/the-nine" }]);
    expect(poolStatements.map(({ statement }) => statement)).toEqual([
      expect.stringContaining("insert into provider_webhook_events"),
      expect.stringContaining("select id, member_id, status from verification_cases")
    ]);
    expect(poolStatements[0]?.values?.[0]).toEqual(expect.stringMatching(uuidV7Pattern));
    expect(transactionStatements.map(({ statement }) => statement)).toEqual([
      "begin",
      expect.stringContaining("update verification_cases"),
      expect.stringContaining("update members"),
      expect.stringContaining("insert into domain_event_outbox"),
      expect.stringContaining("update provider_webhook_events"),
      "commit"
    ]);
    expect(transactionStatements[3]?.values?.[0]).toEqual(expect.stringMatching(uuidV7Pattern));
    expect(releaseCount).toBe(1);
    expect(JSON.stringify({ poolStatements, transactionStatements })).not.toMatch(
      /raw-provider-artifact|documentImage|government|liveness|selfie/i
    );

    await app.close();
    expect(poolEndCount).toBe(1);
  });

  it("fails closed when DATABASE_URL is not configured", async () => {
    const createApp = productionAppApi.createApiProductionApp;
    expect(createApp).toBeTypeOf("function");
    if (createApp === undefined) {
      return;
    }

    await expect(
      createApp({
        env: {
          PERSONA_WEBHOOK_SECRET: "whsec_production"
        },
        createPostgresPool: () => {
          throw new Error("pool should not be created without DATABASE_URL.");
        },
        now: () => new Date("2027-06-16T12:05:00.000Z"),
        signatureNow: () => 1_813_233_600
      })
    ).rejects.toThrow("DATABASE_URL is required.");
  });
});
