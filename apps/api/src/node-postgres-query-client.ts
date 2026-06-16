import pg from "pg";
import type {
  PersonaWebhookPostgresQueryClient,
  PersonaWebhookPostgresQueryExecutor,
  PersonaWebhookPostgresQueryResult
} from "./persona-webhook-postgres-persistence.js";

const { Pool } = pg;

export interface NodePostgresQueryResult<Row> {
  rows: Row[];
  rowCount: number | null;
}

export interface NodePostgresQueryExecutor {
  query: <Row = Record<string, unknown>>(
    statement: string,
    values?: readonly unknown[]
  ) => Promise<NodePostgresQueryResult<Row>>;
}

export interface NodePostgresClient extends NodePostgresQueryExecutor {
  release: () => void;
}

export interface NodePostgresPool extends NodePostgresQueryExecutor {
  connect: () => Promise<NodePostgresClient>;
  end?: () => Promise<void>;
}

export interface NodePostgresPoolConfig {
  connectionString: string;
  max?: number;
}

export function createNodePostgresPool(config: NodePostgresPoolConfig): NodePostgresPool {
  return new Pool(config);
}

export function createPersonaWebhookNodePostgresQueryClient(
  pool: NodePostgresPool
): PersonaWebhookPostgresQueryClient {
  return {
    query: async <Row = Record<string, unknown>>(
      statement: string,
      values: readonly unknown[]
    ): Promise<PersonaWebhookPostgresQueryResult<Row>> => queryNodePostgres(pool, statement, values),
    transaction: async <Result>(
      callback: (transactionClient: PersonaWebhookPostgresQueryExecutor) => Promise<Result>
    ): Promise<Result> => {
      const client = await pool.connect();

      try {
        await queryNodePostgres(client, "begin", []);
        const result = await callback({
          query: async <Row = Record<string, unknown>>(
            statement: string,
            values: readonly unknown[]
          ): Promise<PersonaWebhookPostgresQueryResult<Row>> => queryNodePostgres(client, statement, values)
        });
        await queryNodePostgres(client, "commit", []);

        return result;
      } catch (error) {
        await queryNodePostgres(client, "rollback", []);
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

async function queryNodePostgres<Row>(
  executor: NodePostgresQueryExecutor,
  statement: string,
  values: readonly unknown[]
): Promise<PersonaWebhookPostgresQueryResult<Row>> {
  const result = await executor.query<Row>(statement, values);

  return {
    rows: result.rows,
    rowCount: result.rowCount ?? result.rows.length
  };
}
