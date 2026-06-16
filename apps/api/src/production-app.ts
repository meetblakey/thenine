import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  createNodePostgresPool,
  createPersonaWebhookNodePostgresQueryClient,
  type NodePostgresPool,
  type NodePostgresPoolConfig
} from "./node-postgres-query-client.js";
import { createApiFastifyAppFromRuntimeConfig } from "./runtime-app.js";

export interface ApiProductionEnvironment {
  DATABASE_URL?: string;
  PERSONA_WEBHOOK_SECRET?: string;
}

export interface ApiProductionAppConfig {
  env: ApiProductionEnvironment;
  createPostgresPool?: (config: NodePostgresPoolConfig) => NodePostgresPool;
  now?: () => Date;
  signatureNow?: () => number;
  signatureToleranceSeconds?: number;
  generateId?: (kind: "provider_webhook_event" | "domain_event_outbox") => string;
}

export async function createApiProductionApp(config: ApiProductionAppConfig): Promise<FastifyInstance> {
  const createPostgresPool = config.createPostgresPool ?? createNodePostgresPool;
  const pool = createPostgresPool({
    connectionString: readRequiredProductionEnv(config.env, "DATABASE_URL")
  });
  const app = await createApiFastifyAppFromRuntimeConfig({
    env: config.env,
    queryClient: createPersonaWebhookNodePostgresQueryClient(pool),
    now: config.now ?? (() => new Date()),
    ...(config.signatureNow === undefined ? {} : { signatureNow: config.signatureNow }),
    ...(config.signatureToleranceSeconds === undefined
      ? {}
      : { signatureToleranceSeconds: config.signatureToleranceSeconds }),
    generateId: config.generateId ?? generateUuidV7
  });

  app.addHook("onClose", async () => {
    await pool.end?.();
  });

  return app;
}

function readRequiredProductionEnv(env: ApiProductionEnvironment, name: keyof ApiProductionEnvironment): string {
  const value = env[name]?.trim();

  if (value === undefined || value === "") {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function generateUuidV7(): string {
  const bytes = randomBytes(16);
  const timestamp = BigInt(Date.now());

  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  return formatUuid(bytes);
}

function formatUuid(bytes: Buffer): string {
  const hex = bytes.toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
