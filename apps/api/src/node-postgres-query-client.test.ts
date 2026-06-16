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
}

type NodePostgresApiExports = typeof api & {
  createPersonaWebhookNodePostgresQueryClient?: (pool: NodePostgresPool) => PersonaWebhookPostgresQueryClient;
};

const nodePostgresApi = api as NodePostgresApiExports;

describe("node-postgres Persona webhook query client", () => {
  it("delegates non-transactional queries to the pool", async () => {
    const createQueryClient = nodePostgresApi.createPersonaWebhookNodePostgresQueryClient;
    expect(createQueryClient).toBeTypeOf("function");
    if (createQueryClient === undefined) {
      return;
    }

    const poolStatements: Array<{ statement: string; values: readonly unknown[] | undefined }> = [];
    const pool: NodePostgresPool = {
      query: async <Row = Record<string, unknown>>(
        statement: string,
        values?: readonly unknown[]
      ): Promise<NodePostgresQueryResult<Row>> => {
        poolStatements.push({ statement, values });
        return { rows: [{ ok: true }] as Row[], rowCount: 1 };
      },
      connect: async () => {
        throw new Error("connect should not be called for non-transactional queries.");
      }
    };

    const queryClient = createQueryClient(pool);

    await expect(queryClient.query("select $1::text as value", ["runtime"])).resolves.toEqual({
      rows: [{ ok: true }],
      rowCount: 1
    });
    expect(poolStatements).toEqual([{ statement: "select $1::text as value", values: ["runtime"] }]);
  });

  it("commits successful transactions and releases the checked-out client", async () => {
    const createQueryClient = nodePostgresApi.createPersonaWebhookNodePostgresQueryClient;
    expect(createQueryClient).toBeTypeOf("function");
    if (createQueryClient === undefined) {
      return;
    }

    const transactionStatements: Array<{ statement: string; values: readonly unknown[] | undefined }> = [];
    let releaseCount = 0;
    const client: NodePostgresClient = {
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
      query: async () => {
        throw new Error("pool.query should not be used inside a transaction callback.");
      },
      connect: async () => client
    };

    const queryClient = createQueryClient(pool);
    const result = await queryClient.transaction(async (transactionClient) => {
      await transactionClient.query("update members set verification_status = $1 where id = $2", [
        "approved",
        "member_1"
      ]);
      return "committed";
    });

    expect(result).toBe("committed");
    expect(transactionStatements).toEqual([
      { statement: "begin", values: [] },
      {
        statement: "update members set verification_status = $1 where id = $2",
        values: ["approved", "member_1"]
      },
      { statement: "commit", values: [] }
    ]);
    expect(releaseCount).toBe(1);
  });

  it("rolls back failed transactions before releasing the checked-out client", async () => {
    const createQueryClient = nodePostgresApi.createPersonaWebhookNodePostgresQueryClient;
    expect(createQueryClient).toBeTypeOf("function");
    if (createQueryClient === undefined) {
      return;
    }

    const transactionStatements: Array<{ statement: string; values: readonly unknown[] | undefined }> = [];
    let releaseCount = 0;
    const client: NodePostgresClient = {
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
      query: async () => {
        throw new Error("pool.query should not be used inside a transaction callback.");
      },
      connect: async () => client
    };

    const queryClient = createQueryClient(pool);

    await expect(
      queryClient.transaction(async (transactionClient) => {
        await transactionClient.query("update verification_cases set status = $1", ["rejected"]);
        throw new Error("transition persistence failed");
      })
    ).rejects.toThrow("transition persistence failed");
    expect(transactionStatements).toEqual([
      { statement: "begin", values: [] },
      { statement: "update verification_cases set status = $1", values: ["rejected"] },
      { statement: "rollback", values: [] }
    ]);
    expect(releaseCount).toBe(1);
  });
});
