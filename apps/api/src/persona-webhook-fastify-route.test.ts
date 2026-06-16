import { createHmac } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { VerificationStatus } from "@thenine/domain";
import * as api from "./index.js";

interface PersonaWebhookFastifyRouteConfig {
  webhookSecret: string;
  now?: () => number;
  signatureToleranceSeconds?: number;
  reserveProviderWebhookEvent: (input: { provider: "persona"; eventId: string; inquiryId: string }) => Promise<void>;
  loadVerificationCaseByInquiryId: (inquiryId: string) => Promise<{ memberId: string; status: VerificationStatus }>;
  persistVerificationTransition: (input: Record<string, unknown>) => Promise<void>;
}

type PersonaWebhookFastifyApiExports = typeof api & {
  registerPersonaWebhookFastifyRoute?: (
    app: FastifyInstance,
    config: PersonaWebhookFastifyRouteConfig
  ) => Promise<void>;
};

const personaWebhookFastifyApi = api as PersonaWebhookFastifyApiExports;

describe("Persona webhook Fastify route", () => {
  it("validates Persona signatures against the exact raw HTTP body before processing the event", async () => {
    expect(personaWebhookFastifyApi.registerPersonaWebhookFastifyRoute).toBeTypeOf("function");

    const timestamp = 1_813_221_600;
    const webhookSecret = "whsec_fastify_test";
    const rawBody =
      '{"id":"persona_event_fastify_1","createdAt":"2027-06-16T09:00:00.000Z","data":{"inquiryId":"inq_fastify_1","status":"approved","documentImage":"raw-provider-artifact"}}';
    const digest = createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
    const reserveProviderWebhookEvent = vi.fn(async () => undefined);
    const loadVerificationCaseByInquiryId = vi.fn(async () => ({ memberId: "member_1", status: "pending" as const }));
    const persistVerificationTransition = vi.fn(async () => undefined);
    const app = Fastify();

    await personaWebhookFastifyApi.registerPersonaWebhookFastifyRoute?.(app, {
      webhookSecret,
      now: () => timestamp,
      reserveProviderWebhookEvent,
      loadVerificationCaseByInquiryId,
      persistVerificationTransition
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
    expect(reserveProviderWebhookEvent).toHaveBeenCalledWith({
      provider: "persona",
      eventId: "persona_event_fastify_1",
      inquiryId: "inq_fastify_1"
    });
    expect(loadVerificationCaseByInquiryId).toHaveBeenCalledWith("inq_fastify_1");
    expect(persistVerificationTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "member_1",
        previousStatus: "pending",
        nextStatus: "approved",
        outboxEvent: expect.objectContaining({ eventName: "verification.status_changed" })
      })
    );
    expect(JSON.stringify(persistVerificationTransition.mock.calls)).not.toMatch(/raw-provider-artifact|documentImage|liveness|selfie/i);

    await app.close();
  });
});
