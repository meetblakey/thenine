import { createHmac } from "node:crypto";
import type { VerificationProviderEvent, VerificationStatus } from "@thenine/domain";
import { describe, expect, it, vi } from "vitest";

import * as api from "./index.js";

interface PersonaWebhookDependencies {
  verifyPersonaSignature: (rawRequestBody: string | Buffer, signature: string) => Promise<void>;
  normalizePersonaWebhook: (rawBody: Record<string, unknown>) => VerificationProviderEvent;
  reserveProviderWebhookEvent: (input: { provider: "persona"; eventId: string; inquiryId: string }) => Promise<void>;
  loadVerificationCaseByInquiryId: (inquiryId: string) => Promise<{ memberId: string; status: VerificationStatus }>;
  persistVerificationTransition: (input: Record<string, unknown>) => Promise<void>;
}

type CreatePersonaWebhookDependencies = (input: {
  webhookSecret: string;
  now?: () => number;
  signatureToleranceSeconds?: number;
  reserveProviderWebhookEvent: PersonaWebhookDependencies["reserveProviderWebhookEvent"];
  loadVerificationCaseByInquiryId: PersonaWebhookDependencies["loadVerificationCaseByInquiryId"];
  persistVerificationTransition: PersonaWebhookDependencies["persistVerificationTransition"];
}) => PersonaWebhookDependencies;

type ApiExports = typeof api & {
  createPersonaWebhookDependencies?: CreatePersonaWebhookDependencies;
};

const apiExports = api as ApiExports;

describe("Persona webhook dependency wiring", () => {
  it("binds the Persona secret to raw-body signature verification before normalization", async () => {
    expect(apiExports.createPersonaWebhookDependencies).toBeTypeOf("function");

    const parsedBody = {
      id: "persona_event_1",
      createdAt: "2026-06-16T09:10:00.000Z",
      data: {
        inquiryId: "inq_1",
        status: "approved",
        documentImage: "raw-provider-artifact"
      }
    };
    const rawRequestBody = JSON.stringify(parsedBody);
    const timestamp = 1780000000;
    const webhookSecret = "whsec_test_secret";
    const digest = createHmac("sha256", webhookSecret).update(`${timestamp}.${rawRequestBody}`).digest("hex");
    const signature = `t=${timestamp},v1=${digest}`;
    const reserveProviderWebhookEvent = vi.fn(async () => undefined);
    const loadVerificationCaseByInquiryId = vi.fn(async () => ({ memberId: "member_1", status: "pending" as const }));
    const persistVerificationTransition = vi.fn(async () => undefined);

    const dependencies = apiExports.createPersonaWebhookDependencies?.({
      webhookSecret,
      now: () => timestamp + 30,
      signatureToleranceSeconds: 300,
      reserveProviderWebhookEvent,
      loadVerificationCaseByInquiryId,
      persistVerificationTransition
    });

    expect(dependencies).toBeDefined();
    await expect(dependencies?.verifyPersonaSignature(rawRequestBody, signature)).resolves.toBeUndefined();
    await expect(dependencies?.verifyPersonaSignature(JSON.stringify({ tampered: true }), signature)).rejects.toMatchObject({
      code: "PROVIDER_SIGNATURE_INVALID"
    });

    expect(dependencies?.normalizePersonaWebhook(parsedBody)).toEqual({
      provider: "persona",
      eventId: "persona_event_1",
      inquiryId: "inq_1",
      occurredAt: "2026-06-16T09:10:00.000Z",
      rawStatus: "approved",
      riskTags: []
    });
    expect(JSON.stringify(dependencies?.normalizePersonaWebhook(parsedBody))).not.toMatch(/raw-provider-artifact|documentImage|liveness|selfie/i);

    await dependencies?.reserveProviderWebhookEvent({ provider: "persona", eventId: "persona_event_1", inquiryId: "inq_1" });
    await dependencies?.loadVerificationCaseByInquiryId("inq_1");
    const transition = {
      provider: "persona" as const,
      providerEventId: "persona_event_1",
      providerInquiryId: "inq_1",
      memberId: "member_1",
      previousStatus: "pending" as const,
      nextStatus: "approved" as const,
      failureReasonCode: null,
      riskFlags: [],
      emitGroupEligibilityRecompute: true,
      outboxEvent: {
        aggregateType: "member" as const,
        aggregateId: "member_1",
        eventName: "verification.status_changed" as const,
        eventVersion: 1 as const,
        payload: {
          memberId: "member_1",
          status: "approved" as const,
          failureReasonCode: null
        }
      }
    };
    await dependencies?.persistVerificationTransition(transition);

    expect(reserveProviderWebhookEvent).toHaveBeenCalledWith({ provider: "persona", eventId: "persona_event_1", inquiryId: "inq_1" });
    expect(loadVerificationCaseByInquiryId).toHaveBeenCalledWith("inq_1");
    expect(persistVerificationTransition).toHaveBeenCalledWith(transition);
  });

  it("rejects missing Persona webhook secrets at dependency construction", () => {
    expect(apiExports.createPersonaWebhookDependencies).toBeTypeOf("function");

    expect(() =>
      apiExports.createPersonaWebhookDependencies?.({
        webhookSecret: " ",
        reserveProviderWebhookEvent: vi.fn(async () => undefined),
        loadVerificationCaseByInquiryId: vi.fn(async () => ({ memberId: "member_1", status: "pending" as const })),
        persistVerificationTransition: vi.fn(async () => undefined)
      })
    ).toThrow(/secret/i);
  });
});
