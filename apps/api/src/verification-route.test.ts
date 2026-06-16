import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";
import type { VerificationStatus } from "@thenine/domain";

interface VerificationRouteMember {
  memberId: string;
  memberStatus: "active" | "suspended" | "banned" | "deleted";
}

interface VerificationRouteContext {
  member: VerificationRouteMember | null;
  idempotencyKey: string | null;
}

interface CreateVerificationSessionBody {
  returnUrl: string;
  platform: "ios" | "android";
}

interface CreateVerificationSessionDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  createPersonaInquiry: (input: { memberId: string; returnUrl: string; platform: "ios" | "android" }) => Promise<{
    inquiryId: string;
    clientSecret: string;
    expiresAt: string;
  }>;
  now: () => Date;
  persistVerificationSession: (input: {
    memberId: string;
    provider: "persona";
    providerInquiryId: string;
    status: "pending";
    createdAt: string;
  }) => Promise<void>;
}

interface VerificationStatusResource {
  status: VerificationStatus;
  failureReasonCode: string | null;
  appealStatus: string | null;
  verifiedAt: string | null;
}

interface GetVerificationStatusDependencies {
  loadVerificationStatus: (memberId: string) => Promise<VerificationStatusResource>;
}

interface VerificationAppealBody {
  narrative: string;
  contactEmail?: string;
}

interface VerificationAppealDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadVerificationStatusForAppeal: (memberId: string) => Promise<{
    status: VerificationStatus;
    appealStatus: string | null;
    caseId: string;
  }>;
  now: () => Date;
  persistVerificationAppeal: (input: {
    memberId: string;
    caseId: string;
    narrative: string;
    contactEmail?: string;
    appealStatus: "submitted";
    submittedAt: string;
  }) => Promise<{ appealStatus: "submitted"; caseId: string }>;
}

interface PersonaWebhookContext {
  signature: string | null;
  rawRequestBody: string | Buffer;
}

interface PersonaWebhookRawRequestContext {
  signature: string | null;
}

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

type VerificationApiExports = typeof api & {
  POST_VERIFICATION_SESSION_ROUTE?: { method: string; path: string; auth: string; requiresIdempotencyKey: boolean };
  POST_VERIFICATION_APPEAL_ROUTE?: { method: string; path: string; auth: string; requiresIdempotencyKey: boolean };
  GET_VERIFICATION_STATUS_ROUTE?: { method: string; path: string; auth: string };
  POST_PERSONA_WEBHOOK_ROUTE?: { method: string; path: string; auth: string; isProviderWebhook: boolean };
  handlePostVerificationSession?: (
    context: VerificationRouteContext,
    body: CreateVerificationSessionBody,
    dependencies: CreateVerificationSessionDependencies
  ) => Promise<Record<string, unknown>>;
  handlePostPersonaWebhook?: (
    context: PersonaWebhookContext,
    parsedBody: Record<string, unknown>,
    dependencies: PersonaWebhookDependencies
  ) => Promise<Record<string, unknown>>;
  handlePostPersonaWebhookRawRequest?: (
    context: PersonaWebhookRawRequestContext,
    rawRequestBody: string | Buffer,
    dependencies: PersonaWebhookDependencies
  ) => Promise<Record<string, unknown>>;
  handleGetVerificationStatus?: (
    context: { member: VerificationRouteMember | null },
    dependencies: GetVerificationStatusDependencies
  ) => Promise<VerificationStatusResource>;
  handlePostVerificationAppeal?: (
    context: VerificationRouteContext,
    body: VerificationAppealBody,
    dependencies: VerificationAppealDependencies
  ) => Promise<{ appealStatus: "submitted"; caseId: string }>;
};

const verificationApi = api as VerificationApiExports;
const activeMember: VerificationRouteMember = { memberId: "member_1", memberStatus: "active" };

describe("verification API routes", () => {
  it("publishes route metadata for session, status, and Persona webhook contracts", () => {
    expect(verificationApi.POST_VERIFICATION_SESSION_ROUTE).toEqual({
      method: "POST",
      path: "/v1/verification/sessions",
      auth: "Member JWT",
      requiresIdempotencyKey: true
    });
    expect(verificationApi.GET_VERIFICATION_STATUS_ROUTE).toEqual({
      method: "GET",
      path: "/v1/verification/status",
      auth: "Member JWT"
    });
    expect(verificationApi.POST_VERIFICATION_APPEAL_ROUTE).toEqual({
      method: "POST",
      path: "/v1/verification/appeals",
      auth: "Member JWT",
      requiresIdempotencyKey: true
    });
    expect(verificationApi.POST_PERSONA_WEBHOOK_ROUTE).toEqual({
      method: "POST",
      path: "/v1/webhooks/persona",
      auth: "Persona signature",
      isProviderWebhook: true
    });
  });

  it("creates a Persona verification session after reserving idempotency and persists only derived state", async () => {
    expect(verificationApi.handlePostVerificationSession).toBeTypeOf("function");

    const reserveIdempotencyKey = vi.fn(async () => undefined);
    const createPersonaInquiry = vi.fn(async () => ({
      inquiryId: "inq_1",
      clientSecret: "client_secret_1",
      expiresAt: "2026-06-16T09:30:00.000Z"
    }));
    const persistVerificationSession = vi.fn(async () => undefined);

    const result = await verificationApi.handlePostVerificationSession?.(
      { member: activeMember, idempotencyKey: "idem-verification-session" },
      { returnUrl: "thenine://verification/return", platform: "ios" },
      {
        reserveIdempotencyKey,
        createPersonaInquiry,
        now: () => new Date("2026-06-16T09:00:00.000Z"),
        persistVerificationSession
      }
    );

    expect(reserveIdempotencyKey).toHaveBeenCalledWith("POST /v1/verification/sessions", "idem-verification-session", "member_1");
    expect(createPersonaInquiry).toHaveBeenCalledWith({
      memberId: "member_1",
      returnUrl: "thenine://verification/return",
      platform: "ios"
    });
    expect(persistVerificationSession).toHaveBeenCalledWith({
      memberId: "member_1",
      provider: "persona",
      providerInquiryId: "inq_1",
      status: "pending",
      createdAt: "2026-06-16T09:00:00.000Z"
    });
    expect(result).toEqual({
      provider: "persona",
      inquiryId: "inq_1",
      clientSecret: "client_secret_1",
      expiresAt: "2026-06-16T09:30:00.000Z"
    });
    expect(JSON.stringify(persistVerificationSession.mock.calls)).not.toMatch(/government|documentImage|liveness|selfie/i);
  });

  it("processes Persona webhooks only after signature verification and provider-event idempotency", async () => {
    expect(verificationApi.handlePostPersonaWebhook).toBeTypeOf("function");

    const parsedBody = {
      id: "persona_event_1",
      data: {
        inquiryId: "inq_1",
        status: "approved",
        documentImage: "raw-provider-artifact"
      }
    };
    const rawRequestBody = JSON.stringify(parsedBody);
    const verifyPersonaSignature = vi.fn(async () => undefined);
    const normalizePersonaWebhook = vi.fn(() => ({
      provider: "persona" as const,
      eventId: "persona_event_1",
      inquiryId: "inq_1",
      occurredAt: "2026-06-16T09:10:00.000Z",
      rawStatus: "approved",
      riskTags: ["document_verified"]
    }));
    const reserveProviderWebhookEvent = vi.fn(async () => undefined);
    const loadVerificationCaseByInquiryId = vi.fn(async () => ({ memberId: "member_1", status: "pending" as const }));
    const persistVerificationTransition = vi.fn(async () => undefined);

    const result = await verificationApi.handlePostPersonaWebhook?.(
      { signature: "persona-signature", rawRequestBody },
      parsedBody,
      {
        verifyPersonaSignature,
        normalizePersonaWebhook,
        reserveProviderWebhookEvent,
        loadVerificationCaseByInquiryId,
        persistVerificationTransition
      }
    );

    expect(verifyPersonaSignature).toHaveBeenCalledWith(rawRequestBody, "persona-signature");
    expect(normalizePersonaWebhook).toHaveBeenCalledWith(parsedBody);
    expect(reserveProviderWebhookEvent).toHaveBeenCalledWith({
      provider: "persona",
      eventId: "persona_event_1",
      inquiryId: "inq_1"
    });
    expect(loadVerificationCaseByInquiryId).toHaveBeenCalledWith("inq_1");
    expect(persistVerificationTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "member_1",
        previousStatus: "pending",
        nextStatus: "approved",
        outboxEvent: expect.objectContaining({ eventName: "verification.status_changed" })
      })
    );
    expect(JSON.stringify(persistVerificationTransition.mock.calls)).not.toMatch(/raw-provider-artifact|documentImage|liveness|selfie/i);
    expect(result).toEqual({ received: true });
  });

  it("processes raw Persona webhook requests only after raw-body signature verification", async () => {
    expect(verificationApi.handlePostPersonaWebhookRawRequest).toBeTypeOf("function");

    const parsedBody = {
      id: "persona_event_raw_1",
      data: {
        inquiryId: "inq_raw_1",
        status: "approved",
        selfiePhotoUrl: "https://persona.example/raw-selfie"
      }
    };
    const rawRequestBody = JSON.stringify(parsedBody);
    const verifyPersonaSignature = vi.fn(async () => undefined);
    const normalizePersonaWebhook = vi.fn(() => ({
      provider: "persona" as const,
      eventId: "persona_event_raw_1",
      inquiryId: "inq_raw_1",
      occurredAt: "2026-06-16T09:12:00.000Z",
      rawStatus: "approved",
      riskTags: []
    }));
    const reserveProviderWebhookEvent = vi.fn(async () => undefined);
    const loadVerificationCaseByInquiryId = vi.fn(async () => ({ memberId: "member_1", status: "pending" as const }));
    const persistVerificationTransition = vi.fn(async () => undefined);

    const result = await verificationApi.handlePostPersonaWebhookRawRequest?.(
      { signature: "persona-signature" },
      rawRequestBody,
      {
        verifyPersonaSignature,
        normalizePersonaWebhook,
        reserveProviderWebhookEvent,
        loadVerificationCaseByInquiryId,
        persistVerificationTransition
      }
    );

    expect(verifyPersonaSignature).toHaveBeenCalledWith(rawRequestBody, "persona-signature");
    expect(normalizePersonaWebhook).toHaveBeenCalledWith(parsedBody);
    expect(reserveProviderWebhookEvent).toHaveBeenCalledWith({
      provider: "persona",
      eventId: "persona_event_raw_1",
      inquiryId: "inq_raw_1"
    });
    expect(persistVerificationTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        nextStatus: "approved",
        outboxEvent: expect.objectContaining({ eventName: "verification.status_changed" })
      })
    );
    expect(JSON.stringify(persistVerificationTransition.mock.calls)).not.toMatch(/raw-selfie|selfiePhotoUrl|liveness|documentImage/i);
    expect(result).toEqual({ received: true });
  });

  it("rejects malformed raw Persona webhook JSON only after signature verification succeeds", async () => {
    expect(verificationApi.handlePostPersonaWebhookRawRequest).toBeTypeOf("function");

    const malformedRawBody = "{not-json";
    const dependencies: PersonaWebhookDependencies = {
      verifyPersonaSignature: vi.fn(async () => {
        throw Object.assign(new Error("bad signature"), { code: "PROVIDER_SIGNATURE_INVALID" });
      }),
      normalizePersonaWebhook: vi.fn(),
      reserveProviderWebhookEvent: vi.fn(async () => undefined),
      loadVerificationCaseByInquiryId: vi.fn(),
      persistVerificationTransition: vi.fn(async () => undefined)
    };

    await expect(
      verificationApi.handlePostPersonaWebhookRawRequest?.({ signature: "persona-signature" }, malformedRawBody, dependencies)
    ).rejects.toMatchObject({ code: "PROVIDER_SIGNATURE_INVALID" });
    expect(dependencies.verifyPersonaSignature).toHaveBeenCalledWith(malformedRawBody, "persona-signature");
    expect(dependencies.normalizePersonaWebhook).not.toHaveBeenCalled();
    expect(dependencies.persistVerificationTransition).not.toHaveBeenCalled();
  });

  it("rejects Persona webhooks before normalization when the provider signature is missing", async () => {
    const dependencies: PersonaWebhookDependencies = {
      verifyPersonaSignature: vi.fn(async () => undefined),
      normalizePersonaWebhook: vi.fn(),
      reserveProviderWebhookEvent: vi.fn(async () => undefined),
      loadVerificationCaseByInquiryId: vi.fn(),
      persistVerificationTransition: vi.fn(async () => undefined)
    };

    await expect(
      verificationApi.handlePostPersonaWebhook?.(
        { signature: null, rawRequestBody: JSON.stringify({ id: "persona_event_1" }) },
        { id: "persona_event_1" },
        dependencies
      )
    ).rejects.toMatchObject({ code: "PROVIDER_SIGNATURE_INVALID" });
    expect(dependencies.normalizePersonaWebhook).not.toHaveBeenCalled();
    expect(dependencies.persistVerificationTransition).not.toHaveBeenCalled();
  });

  it("returns the current verification status for the authenticated member", async () => {
    expect(verificationApi.handleGetVerificationStatus).toBeTypeOf("function");

    const loadVerificationStatus = vi.fn(async () => ({
      status: "retry_required" as const,
      failureReasonCode: "image_quality",
      appealStatus: "available",
      verifiedAt: null
    }));

    const result = await verificationApi.handleGetVerificationStatus?.(
      { member: activeMember },
      { loadVerificationStatus }
    );

    expect(loadVerificationStatus).toHaveBeenCalledWith("member_1");
    expect(result).toEqual({
      status: "retry_required",
      failureReasonCode: "image_quality",
      appealStatus: "available",
      verifiedAt: null
    });
  });

  it("submits verification appeals through the domain guard and idempotent API route", async () => {
    expect(verificationApi.handlePostVerificationAppeal).toBeTypeOf("function");

    const reserveIdempotencyKey = vi.fn(async () => undefined);
    const loadVerificationStatusForAppeal = vi.fn(async () => ({
      status: "rejected" as const,
      appealStatus: "available",
      caseId: "verification_case_1"
    }));
    const persistVerificationAppeal = vi.fn(async () => ({ appealStatus: "submitted" as const, caseId: "verification_case_1" }));

    const result = await verificationApi.handlePostVerificationAppeal?.(
      { member: activeMember, idempotencyKey: "idem-verification-appeal" },
      { narrative: "My legal ID was misread.", contactEmail: "member@example.com" },
      {
        reserveIdempotencyKey,
        loadVerificationStatusForAppeal,
        now: () => new Date("2026-06-16T09:20:00.000Z"),
        persistVerificationAppeal
      }
    );

    expect(reserveIdempotencyKey).toHaveBeenCalledWith("POST /v1/verification/appeals", "idem-verification-appeal", "member_1");
    expect(loadVerificationStatusForAppeal).toHaveBeenCalledWith("member_1");
    expect(persistVerificationAppeal).toHaveBeenCalledWith({
      memberId: "member_1",
      caseId: "verification_case_1",
      narrative: "My legal ID was misread.",
      contactEmail: "member@example.com",
      appealStatus: "submitted",
      submittedAt: "2026-06-16T09:20:00.000Z"
    });
    expect(result).toEqual({ appealStatus: "submitted", caseId: "verification_case_1" });
  });
});
