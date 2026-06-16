import { describe, expect, it, vi } from "vitest";
import type { VerificationStatus } from "@thenine/domain";
import * as api from "./index.js";

interface VerificationProviderEvent {
  provider: "persona";
  eventId: string;
  inquiryId: string;
  occurredAt: string;
  rawStatus: string;
  reasonCode?: string;
  riskTags: string[];
}

interface PersonaWebhookDependencies {
  verifyPersonaSignature: (rawRequestBody: string | Buffer, signature: string) => Promise<void>;
  normalizePersonaWebhook: (rawBody: Record<string, unknown>) => VerificationProviderEvent;
  reserveProviderWebhookEvent: (input: { provider: "persona"; eventId: string; inquiryId: string }) => Promise<void>;
  loadVerificationCaseByInquiryId: (inquiryId: string) => Promise<{ memberId: string; status: VerificationStatus }>;
  persistVerificationTransition: (input: Record<string, unknown>) => Promise<void>;
}

interface PersonaWebhookHttpRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string | Buffer;
}

type PersonaWebhookIngressApiExports = typeof api & {
  handlePostPersonaWebhookHttpRequest?: (
    request: PersonaWebhookHttpRequest,
    dependencies: PersonaWebhookDependencies
  ) => Promise<Record<string, unknown>>;
};

const personaWebhookIngressApi = api as PersonaWebhookIngressApiExports;

describe("Persona webhook HTTP ingress", () => {
  it("passes the exact raw body and signature header into the raw webhook handler", async () => {
    expect(personaWebhookIngressApi.handlePostPersonaWebhookHttpRequest).toBeTypeOf("function");

    const parsedBody = {
      id: "persona_event_http_1",
      data: {
        inquiryId: "inq_http_1",
        status: "approved",
        documentImage: "raw-provider-artifact"
      }
    };
    const rawBody = Buffer.from(JSON.stringify(parsedBody));
    const dependencies: PersonaWebhookDependencies = {
      verifyPersonaSignature: vi.fn(async () => undefined),
      normalizePersonaWebhook: vi.fn(() => ({
        provider: "persona" as const,
        eventId: "persona_event_http_1",
        inquiryId: "inq_http_1",
        occurredAt: "2026-06-16T09:30:00.000Z",
        rawStatus: "approved",
        riskTags: []
      })),
      reserveProviderWebhookEvent: vi.fn(async () => undefined),
      loadVerificationCaseByInquiryId: vi.fn(async () => ({ memberId: "member_1", status: "pending" as const })),
      persistVerificationTransition: vi.fn(async () => undefined)
    };

    const result = await personaWebhookIngressApi.handlePostPersonaWebhookHttpRequest?.(
      {
        headers: { "Persona-Signature": "persona-signature" },
        rawBody
      },
      dependencies
    );

    expect(dependencies.verifyPersonaSignature).toHaveBeenCalledWith(rawBody, "persona-signature");
    expect(dependencies.normalizePersonaWebhook).toHaveBeenCalledWith(parsedBody);
    expect(dependencies.reserveProviderWebhookEvent).toHaveBeenCalledWith({
      provider: "persona",
      eventId: "persona_event_http_1",
      inquiryId: "inq_http_1"
    });
    expect(dependencies.persistVerificationTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "member_1",
        previousStatus: "pending",
        nextStatus: "approved",
        outboxEvent: expect.objectContaining({ eventName: "verification.status_changed" })
      })
    );
    expect(JSON.stringify((dependencies.persistVerificationTransition as ReturnType<typeof vi.fn>).mock.calls)).not.toMatch(
      /raw-provider-artifact|documentImage|liveness|selfie/i
    );
    expect(result).toEqual({ received: true });
  });

  it("rejects ambiguous Persona signature header values before verification", async () => {
    const parsedBody = {
      id: "persona_event_http_duplicate_signature",
      data: { inquiryId: "inq_http_duplicate_signature", status: "approved" }
    };
    const dependencies: PersonaWebhookDependencies = {
      verifyPersonaSignature: vi.fn(async () => undefined),
      normalizePersonaWebhook: vi.fn(() => ({
        provider: "persona" as const,
        eventId: "persona_event_http_duplicate_signature",
        inquiryId: "inq_http_duplicate_signature",
        occurredAt: "2026-06-16T09:35:00.000Z",
        rawStatus: "approved",
        riskTags: []
      })),
      reserveProviderWebhookEvent: vi.fn(async () => undefined),
      loadVerificationCaseByInquiryId: vi.fn(async () => ({ memberId: "member_1", status: "pending" as const })),
      persistVerificationTransition: vi.fn(async () => undefined)
    };

    await expect(
      personaWebhookIngressApi.handlePostPersonaWebhookHttpRequest?.(
        {
          headers: { "persona-signature": ["persona-signature-a", "persona-signature-b"] },
          rawBody: JSON.stringify(parsedBody)
        },
        dependencies
      )
    ).rejects.toMatchObject({ code: "PROVIDER_SIGNATURE_INVALID" });
    expect(dependencies.verifyPersonaSignature).not.toHaveBeenCalled();
    expect(dependencies.normalizePersonaWebhook).not.toHaveBeenCalled();
    expect(dependencies.persistVerificationTransition).not.toHaveBeenCalled();
  });
});
