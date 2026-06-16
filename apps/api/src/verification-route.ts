import { buildVerificationStateTransition, submitVerificationAppeal } from "@thenine/domain";
import type { VerificationProviderEvent, VerificationStatus } from "@thenine/domain";
import { ApiRouteError } from "./launchpad-route.js";
import type { ApiErrorCode } from "./launchpad-route.js";

export const POST_VERIFICATION_SESSION_ROUTE = {
  method: "POST",
  path: "/v1/verification/sessions",
  auth: "Member JWT",
  requiresIdempotencyKey: true
} as const;

export const GET_VERIFICATION_STATUS_ROUTE = {
  method: "GET",
  path: "/v1/verification/status",
  auth: "Member JWT"
} as const;

export const POST_VERIFICATION_APPEAL_ROUTE = {
  method: "POST",
  path: "/v1/verification/appeals",
  auth: "Member JWT",
  requiresIdempotencyKey: true
} as const;

export const POST_PERSONA_WEBHOOK_ROUTE = {
  method: "POST",
  path: "/v1/webhooks/persona",
  auth: "Persona signature",
  isProviderWebhook: true
} as const;

export interface VerificationRouteMember {
  memberId: string;
  memberStatus: "active" | "suspended" | "banned" | "deleted";
}

export interface VerificationRouteContext {
  member: VerificationRouteMember | null;
  idempotencyKey: string | null;
}

export interface CreateVerificationSessionBody {
  returnUrl: string;
  platform: "ios" | "android";
}

export interface CreateVerificationSessionDependencies {
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

export interface PersonaWebhookContext {
  signature: string | null;
  rawRequestBody: string | Buffer;
}

export interface PersonaWebhookRawRequestContext {
  signature: string | null;
}

export interface PersonaWebhookDependencies {
  verifyPersonaSignature: (rawRequestBody: string | Buffer, signature: string) => Promise<void>;
  normalizePersonaWebhook: (rawBody: Record<string, unknown>) => VerificationProviderEvent;
  reserveProviderWebhookEvent: (input: { provider: "persona"; eventId: string; inquiryId: string }) => Promise<void>;
  loadVerificationCaseByInquiryId: (inquiryId: string) => Promise<{ memberId: string; status: VerificationStatus }>;
  persistVerificationTransition: (input: ReturnType<typeof buildVerificationStateTransition>) => Promise<void>;
}

export interface VerificationStatusResource {
  status: VerificationStatus;
  failureReasonCode: string | null;
  appealStatus: string | null;
  verifiedAt: string | null;
}

export interface GetVerificationStatusDependencies {
  loadVerificationStatus: (memberId: string) => Promise<VerificationStatusResource>;
}

export interface VerificationAppealBody {
  narrative: string;
  contactEmail?: string;
}

export interface VerificationAppealDependencies {
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

export async function handlePostVerificationSession(
  context: VerificationRouteContext,
  body: CreateVerificationSessionBody,
  dependencies: CreateVerificationSessionDependencies
): Promise<{ provider: "persona"; inquiryId: string; clientSecret: string; expiresAt: string }> {
  const member = requireVerificationMember(context.member);
  await reserveRequiredVerificationIdempotency(context, dependencies.reserveIdempotencyKey);

  if (member.memberStatus !== "active") {
    throw new ApiRouteError("FORBIDDEN", "Only active members can start verification.");
  }

  const inquiry = await dependencies.createPersonaInquiry({
    memberId: member.memberId,
    returnUrl: body.returnUrl,
    platform: body.platform
  });

  await dependencies.persistVerificationSession({
    memberId: member.memberId,
    provider: "persona",
    providerInquiryId: inquiry.inquiryId,
    status: "pending",
    createdAt: dependencies.now().toISOString()
  });

  return {
    provider: "persona",
    inquiryId: inquiry.inquiryId,
    clientSecret: inquiry.clientSecret,
    expiresAt: inquiry.expiresAt
  };
}

export async function handlePostPersonaWebhook(
  context: PersonaWebhookContext,
  parsedBody: Record<string, unknown>,
  dependencies: PersonaWebhookDependencies
): Promise<{ received: true }> {
  if (context.signature === null || context.signature.trim() === "") {
    throw new ApiRouteError("PROVIDER_SIGNATURE_INVALID", "Persona webhook signature is required.");
  }

  await dependencies.verifyPersonaSignature(context.rawRequestBody, context.signature);

  return persistPersonaWebhook(parsedBody, dependencies);
}

export async function handlePostPersonaWebhookRawRequest(
  context: PersonaWebhookRawRequestContext,
  rawRequestBody: string | Buffer,
  dependencies: PersonaWebhookDependencies
): Promise<{ received: true }> {
  if (context.signature === null || context.signature.trim() === "") {
    throw new ApiRouteError("PROVIDER_SIGNATURE_INVALID", "Persona webhook signature is required.");
  }

  await dependencies.verifyPersonaSignature(rawRequestBody, context.signature);

  return persistPersonaWebhook(parsePersonaWebhookRawRequestBody(rawRequestBody), dependencies);
}

async function persistPersonaWebhook(
  parsedBody: Record<string, unknown>,
  dependencies: PersonaWebhookDependencies
): Promise<{ received: true }> {
  const providerEvent = dependencies.normalizePersonaWebhook(parsedBody);
  await dependencies.reserveProviderWebhookEvent({
    provider: providerEvent.provider,
    eventId: providerEvent.eventId,
    inquiryId: providerEvent.inquiryId
  });
  const verificationCase = await dependencies.loadVerificationCaseByInquiryId(providerEvent.inquiryId);
  const transition = buildVerificationStateTransition({
    memberId: verificationCase.memberId,
    previousStatus: verificationCase.status,
    providerEvent
  });
  await dependencies.persistVerificationTransition(transition);

  return { received: true };
}

function parsePersonaWebhookRawRequestBody(rawRequestBody: string | Buffer): Record<string, unknown> {
  const bodyText = typeof rawRequestBody === "string" ? rawRequestBody : rawRequestBody.toString("utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new ApiRouteError("VALIDATION_ERROR", "Persona webhook body must be valid JSON.");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiRouteError("VALIDATION_ERROR", "Persona webhook body must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

export async function handleGetVerificationStatus(
  context: { member: VerificationRouteMember | null },
  dependencies: GetVerificationStatusDependencies
): Promise<VerificationStatusResource> {
  const member = requireVerificationMember(context.member);

  return dependencies.loadVerificationStatus(member.memberId);
}

export async function handlePostVerificationAppeal(
  context: VerificationRouteContext,
  body: VerificationAppealBody,
  dependencies: VerificationAppealDependencies
): Promise<{ appealStatus: "submitted"; caseId: string }> {
  const member = requireVerificationMember(context.member);
  await reserveRequiredVerificationRouteIdempotency(
    POST_VERIFICATION_APPEAL_ROUTE.method,
    POST_VERIFICATION_APPEAL_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  const current = await dependencies.loadVerificationStatusForAppeal(member.memberId);
  const submission = submitVerificationAppeal({
    memberId: member.memberId,
    verificationStatus: current.status,
    currentAppealStatus: current.appealStatus,
    caseId: current.caseId,
    narrative: body.narrative,
    ...(body.contactEmail === undefined ? {} : { contactEmail: body.contactEmail }),
    submittedAt: dependencies.now().toISOString()
  });

  return dependencies.persistVerificationAppeal({
    memberId: member.memberId,
    caseId: current.caseId,
    narrative: body.narrative,
    ...(body.contactEmail === undefined ? {} : { contactEmail: body.contactEmail }),
    appealStatus: submission.appealStatus,
    submittedAt: submission.submittedAt
  });
}

function requireVerificationMember(member: VerificationRouteMember | null): VerificationRouteMember {
  if (member === null) {
    throw new ApiRouteError("UNAUTHENTICATED", "Verification routes require a member session.");
  }

  return member;
}

async function reserveRequiredVerificationIdempotency(
  context: VerificationRouteContext,
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>
): Promise<void> {
  await reserveRequiredVerificationRouteIdempotency(
    POST_VERIFICATION_SESSION_ROUTE.method,
    POST_VERIFICATION_SESSION_ROUTE.path,
    context,
    reserveIdempotencyKey
  );
}

async function reserveRequiredVerificationRouteIdempotency(
  method: string,
  path: string,
  context: VerificationRouteContext,
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>
): Promise<void> {
  if (context.idempotencyKey === null || context.idempotencyKey.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Mutating verification routes require Idempotency-Key.");
  }

  const member = requireVerificationMember(context.member);
  await reserveIdempotencyKey(`${method} ${path}`, context.idempotencyKey, member.memberId);
}

export function mapVerificationDomainError(error: unknown): Error {
  return error instanceof Error ? error : new ApiRouteError("UNPROCESSABLE_STATE" as ApiErrorCode, "Unexpected verification route failure.");
}
