import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { normalizePersonaWebhook, verifyPersonaWebhookSignature } from "./persona-adapter.js";

describe("Persona verification adapter", () => {
  it("verifies Persona webhook signatures over timestamped raw request bodies", () => {
    const rawBody = JSON.stringify({ data: { id: "persona_event_1" } });
    const timestamp = 1780000000;
    const secret = "whsec_test_secret";
    const digest = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

    expect(() =>
      verifyPersonaWebhookSignature({
        rawBody,
        signatureHeader: `t=${timestamp},v1=${digest}`,
        secret,
        now: () => timestamp + 30,
        toleranceSeconds: 300
      })
    ).not.toThrow();
  });

  it("accepts any matching Persona signature when the header includes rotating signatures", () => {
    const rawBody = JSON.stringify({ data: { id: "persona_event_1" } });
    const timestamp = 1780000000;
    const secret = "whsec_test_secret";
    const digest = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

    expect(() =>
      verifyPersonaWebhookSignature({
        rawBody,
        signatureHeader: `t=${timestamp},v1=${"0".repeat(64)} t=${timestamp},v1=${digest}`,
        secret,
        now: () => timestamp + 30,
        toleranceSeconds: 300
      })
    ).not.toThrow();

    expect(() =>
      verifyPersonaWebhookSignature({
        rawBody,
        signatureHeader: `t=${timestamp},v1=${digest} t=${timestamp},v1=${"0".repeat(64)}`,
        secret,
        now: () => timestamp + 30,
        toleranceSeconds: 300
      })
    ).not.toThrow();
  });

  it("rejects tampered or stale Persona webhook signatures", () => {
    const rawBody = JSON.stringify({ data: { id: "persona_event_1" } });
    const timestamp = 1780000000;
    const secret = "whsec_test_secret";
    const digest = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

    expect(() =>
      verifyPersonaWebhookSignature({
        rawBody: JSON.stringify({ data: { id: "persona_event_tampered" } }),
        signatureHeader: `t=${timestamp},v1=${digest}`,
        secret,
        now: () => timestamp + 30,
        toleranceSeconds: 300
      })
    ).toThrow(/signature/i);

    expect(() =>
      verifyPersonaWebhookSignature({
        rawBody,
        signatureHeader: `t=${timestamp},v1=${digest}`,
        secret,
        now: () => timestamp + 301,
        toleranceSeconds: 300
      })
    ).toThrow(/stale/i);
  });

  it("normalizes signed Persona webhook payloads without returning raw verification artifacts", () => {
    const providerEvent = normalizePersonaWebhook({
      data: {
        id: "persona_event_1",
        attributes: {
          name: "inquiry.approved",
          "created-at": "2026-06-16T09:10:00.000Z",
          payload: {
            data: {
              id: "inq_1",
              attributes: {
                status: "approved",
                fields: {
                  "identification-number": { value: "raw-government-id" }
                },
                "document-front-photo": {
                  url: "https://persona.example/raw-document-front"
                },
                "selfie-photo": {
                  url: "https://persona.example/raw-liveness-selfie"
                }
              }
            }
          }
        }
      }
    });

    expect(providerEvent).toEqual({
      provider: "persona",
      eventId: "persona_event_1",
      inquiryId: "inq_1",
      occurredAt: "2026-06-16T09:10:00.000Z",
      rawStatus: "approved",
      riskTags: []
    });
    expect(JSON.stringify(providerEvent)).not.toMatch(/government|document|selfie|liveness|raw-document|identification/i);
  });

  it("maps Persona retry and decline events into internal status reasons", () => {
    expect(
      normalizePersonaWebhook({
        id: "persona_event_retry",
        createdAt: "2026-06-16T09:20:00.000Z",
        data: {
          inquiryId: "inq_retry",
          status: "needs_retry",
          reasonCode: "image_quality",
          riskTags: ["blurry_document"]
        }
      })
    ).toEqual({
      provider: "persona",
      eventId: "persona_event_retry",
      inquiryId: "inq_retry",
      occurredAt: "2026-06-16T09:20:00.000Z",
      rawStatus: "retry_required",
      reasonCode: "image_quality",
      riskTags: ["blurry_document"]
    });

    expect(
      normalizePersonaWebhook({
        id: "persona_event_declined",
        createdAt: "2026-06-16T09:25:00.000Z",
        data: {
          inquiryId: "inq_declined",
          status: "declined",
          reasonCode: "policy_declined"
        }
      })
    ).toMatchObject({
      rawStatus: "rejected",
      reasonCode: "policy_declined"
    });
  });

  it("rejects unmapped or incomplete Persona webhook payloads", () => {
    expect(() =>
      normalizePersonaWebhook({
        id: "persona_event_unknown",
        createdAt: "2026-06-16T09:30:00.000Z",
        data: {
          inquiryId: "inq_unknown",
          status: "mystery"
        }
      })
    ).toThrow(/not mapped/i);

    expect(() =>
      normalizePersonaWebhook({
        id: "persona_event_missing",
        data: {
          status: "approved"
        }
      })
    ).toThrow(/inquiry/i);
  });
});
