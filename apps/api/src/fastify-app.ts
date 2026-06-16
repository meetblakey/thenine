import Fastify, { type FastifyInstance } from "fastify";
import {
  registerPersonaWebhookFastifyRoute,
  type PersonaWebhookFastifyRouteConfig
} from "./persona-webhook-fastify-route.js";

export interface ApiFastifyAppConfig {
  personaWebhook: PersonaWebhookFastifyRouteConfig;
}

export async function createApiFastifyApp(config: ApiFastifyAppConfig): Promise<FastifyInstance> {
  const app = Fastify();

  app.get("/healthz", async () => ({ ok: true }));

  await registerPersonaWebhookFastifyRoute(app, config.personaWebhook);

  return app;
}
