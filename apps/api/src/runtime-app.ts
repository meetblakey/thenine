import type { FastifyInstance } from "fastify";
import { createApiFastifyApp } from "./fastify-app.js";
import {
  createPersonaWebhookPostgresPersistence,
  type PersonaWebhookPostgresQueryClient
} from "./persona-webhook-postgres-persistence.js";

export interface ApiRuntimeEnvironment {
  PERSONA_WEBHOOK_SECRET?: string;
}

export interface ApiFastifyRuntimeConfig {
  env: ApiRuntimeEnvironment;
  queryClient: PersonaWebhookPostgresQueryClient;
  now: () => Date;
  signatureNow?: () => number;
  signatureToleranceSeconds?: number;
  generateId: (kind: "provider_webhook_event" | "domain_event_outbox") => string;
}

export async function createApiFastifyAppFromRuntimeConfig(
  config: ApiFastifyRuntimeConfig
): Promise<FastifyInstance> {
  const personaWebhookPersistence = createPersonaWebhookPostgresPersistence({
    queryClient: config.queryClient,
    now: config.now,
    generateId: config.generateId
  });

  return createApiFastifyApp({
    personaWebhook: {
      webhookSecret: readRequiredRuntimeSecret(config.env, "PERSONA_WEBHOOK_SECRET"),
      ...(config.signatureNow === undefined ? {} : { now: config.signatureNow }),
      ...(config.signatureToleranceSeconds === undefined
        ? {}
        : { signatureToleranceSeconds: config.signatureToleranceSeconds }),
      ...personaWebhookPersistence
    }
  });
}

function readRequiredRuntimeSecret(env: ApiRuntimeEnvironment, name: keyof ApiRuntimeEnvironment): string {
  const value = env[name]?.trim();

  if (value === undefined || value === "") {
    throw new Error(`${name} is required.`);
  }

  return value;
}
