import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { VerificationStatus } from "@thenine/domain";
import * as api from "./index.js";

interface PersonaWebhookRuntimeDependencies {
  webhookSecret: string;
  now?: () => number;
  reserveProviderWebhookEvent: (input: { provider: "persona"; eventId: string; inquiryId: string }) => Promise<void>;
  loadVerificationCaseByInquiryId: (inquiryId: string) => Promise<{ memberId: string; status: VerificationStatus }>;
  persistVerificationTransition: (input: Record<string, unknown>) => Promise<void>;
}

type FastifyAppApiExports = typeof api & {
  createApiFastifyApp?: (config: { personaWebhook: PersonaWebhookRuntimeDependencies }) => Promise<FastifyInstance>;
};

const fastifyAppApi = api as FastifyAppApiExports;

describe("API Fastify app shell", () => {
  it("mounts health checks and the Persona webhook route with raw-body verification intact", async () => {
    expect(fastifyAppApi.createApiFastifyApp).toBeTypeOf("function");

    const timestamp = 1_813_225_200;
    const webhookSecret = "whsec_api_shell";
    const rawBody =
      '{"id":"persona_event_shell_1","createdAt":"2027-06-16T10:00:00.000Z","data":{"inquiryId":"inq_shell_1","status":"approved","documentImage":"raw-provider-artifact"}}';
    const digest = createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
    const reserveProviderWebhookEvent = vi.fn(async () => undefined);
    const loadVerificationCaseByInquiryId = vi.fn(async () => ({ memberId: "member_1", status: "pending" as const }));
    const persistVerificationTransition = vi.fn(async () => undefined);

    const app = await fastifyAppApi.createApiFastifyApp?.({
      personaWebhook: {
        webhookSecret,
        now: () => timestamp,
        reserveProviderWebhookEvent,
        loadVerificationCaseByInquiryId,
        persistVerificationTransition
      }
    });

    const healthResponse = await app?.inject({ method: "GET", url: "/healthz" });
    expect(healthResponse?.statusCode).toBe(200);
    expect(healthResponse?.json()).toEqual({ ok: true });

    const webhookResponse = await app?.inject({
      method: "POST",
      url: "/v1/webhooks/persona",
      headers: {
        "content-type": "application/json",
        "persona-signature": `t=${timestamp},v1=${digest}`
      },
      payload: rawBody
    });

    expect(webhookResponse?.statusCode).toBe(200);
    expect(webhookResponse?.json()).toEqual({ received: true });
    expect(reserveProviderWebhookEvent).toHaveBeenCalledWith({
      provider: "persona",
      eventId: "persona_event_shell_1",
      inquiryId: "inq_shell_1"
    });
    expect(persistVerificationTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "member_1",
        previousStatus: "pending",
        nextStatus: "approved"
      })
    );
    expect(JSON.stringify(persistVerificationTransition.mock.calls)).not.toMatch(/raw-provider-artifact|documentImage|liveness|selfie/i);

    await app?.close();
  });
});
