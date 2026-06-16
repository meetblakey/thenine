import { createHmac, timingSafeEqual } from "node:crypto";
import type { VerificationProviderEvent } from "@thenine/domain";
import { ApiRouteError } from "./launchpad-route.js";

type PersonaNormalizedStatus = VerificationProviderEvent["rawStatus"];

export interface PersonaWebhookSignatureInput {
  rawBody: string | Buffer;
  signatureHeader: string;
  secret: string;
  now?: () => number;
  toleranceSeconds?: number;
}

export function verifyPersonaWebhookSignature(input: PersonaWebhookSignatureInput): void {
  const signature = parsePersonaSignatureHeader(input.signatureHeader);
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  const nowSeconds = input.now?.() ?? Math.floor(Date.now() / 1000);

  if (Math.abs(nowSeconds - signature.timestamp) > toleranceSeconds) {
    throw new ApiRouteError("PROVIDER_SIGNATURE_INVALID", "Persona webhook signature is stale.");
  }

  const expectedDigest = createHmac("sha256", input.secret)
    .update(`${signature.timestamp}.`)
    .update(input.rawBody)
    .digest("hex");

  if (!signature.v1Candidates.some((candidate) => safeEqualHex(expectedDigest, candidate))) {
    throw new ApiRouteError("PROVIDER_SIGNATURE_INVALID", "Persona webhook signature is invalid.");
  }
}

export function normalizePersonaWebhook(rawBody: Record<string, unknown>): VerificationProviderEvent {
  const eventId = firstStringAt(rawBody, [
    ["data", "id"],
    ["id"]
  ]);
  const inquiryId = firstStringAt(rawBody, [
    ["data", "attributes", "payload", "data", "id"],
    ["data", "inquiryId"],
    ["data", "inquiry_id"],
    ["inquiryId"],
    ["inquiry_id"]
  ]);
  const occurredAt = firstStringAt(rawBody, [
    ["data", "attributes", "created-at"],
    ["data", "attributes", "createdAt"],
    ["createdAt"],
    ["created_at"]
  ]);
  const providerStatus =
    firstStringAt(rawBody, [
      ["data", "attributes", "payload", "data", "attributes", "status"],
      ["data", "status"],
      ["status"]
    ]) ??
    firstStringAt(rawBody, [
      ["data", "attributes", "name"],
      ["name"]
    ]);
  const reasonCode = firstStringAt(rawBody, [
    ["data", "attributes", "payload", "data", "attributes", "reason-code"],
    ["data", "attributes", "payload", "data", "attributes", "reasonCode"],
    ["data", "reasonCode"],
    ["data", "reason_code"],
    ["reasonCode"],
    ["reason_code"]
  ]);
  const riskTags = firstStringArrayAt(rawBody, [
    ["data", "attributes", "payload", "data", "attributes", "risk-tags"],
    ["data", "attributes", "payload", "data", "attributes", "riskTags"],
    ["data", "riskTags"],
    ["data", "risk_tags"],
    ["riskTags"],
    ["risk_tags"]
  ]);

  if (eventId === undefined) {
    throw new ApiRouteError("VALIDATION_ERROR", "Persona webhook requires event id.");
  }

  if (inquiryId === undefined) {
    throw new ApiRouteError("VALIDATION_ERROR", "Persona webhook requires inquiry id.");
  }

  if (occurredAt === undefined) {
    throw new ApiRouteError("VALIDATION_ERROR", "Persona webhook requires occurrence time.");
  }

  if (providerStatus === undefined) {
    throw new ApiRouteError("VALIDATION_ERROR", "Persona webhook requires verification status.");
  }

  return {
    provider: "persona",
    eventId,
    inquiryId,
    occurredAt,
    rawStatus: mapPersonaWebhookStatus(providerStatus),
    ...(reasonCode === undefined ? {} : { reasonCode }),
    riskTags
  };
}

function parsePersonaSignatureHeader(signatureHeader: string): { timestamp: number; v1Candidates: string[] } {
  const timestamp = Number(/\bt=(\d+)\b/.exec(signatureHeader)?.[1]);
  const v1Candidates = Array.from(signatureHeader.matchAll(/\bv1=([0-9a-f]+)/gi), (match) => match[1]).filter(
    (candidate): candidate is string => candidate !== undefined && candidate.trim() !== ""
  );

  if (!Number.isInteger(timestamp) || timestamp <= 0 || v1Candidates.length === 0) {
    throw new ApiRouteError("PROVIDER_SIGNATURE_INVALID", "Persona webhook signature header is invalid.");
  }

  return { timestamp, v1Candidates };
}

function safeEqualHex(expected: string, actual: string): boolean {
  if (!/^[0-9a-f]+$/i.test(actual) || expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}

function mapPersonaWebhookStatus(status: string): PersonaNormalizedStatus {
  const normalized = status.toLowerCase().replaceAll("-", "_");

  if (normalized === "approved" || normalized === "completed" || normalized.endsWith(".approved")) {
    return "approved";
  }

  if (
    normalized === "retry_required" ||
    normalized === "needs_retry" ||
    normalized === "requires_retry" ||
    normalized.endsWith(".needs_retry")
  ) {
    return "retry_required";
  }

  if (
    normalized === "rejected" ||
    normalized === "declined" ||
    normalized === "failed" ||
    normalized.endsWith(".declined") ||
    normalized.endsWith(".rejected")
  ) {
    return "rejected";
  }

  if (
    normalized === "pending" ||
    normalized === "created" ||
    normalized === "started" ||
    normalized === "processing" ||
    normalized === "reviewing" ||
    normalized.endsWith(".created") ||
    normalized.endsWith(".started")
  ) {
    return "pending";
  }

  throw new ApiRouteError("VALIDATION_ERROR", "Persona verification status is not mapped.");
}

function firstStringAt(source: Record<string, unknown>, paths: string[][]): string | undefined {
  for (const path of paths) {
    const value = valueAtPath(source, path);

    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return undefined;
}

function firstStringArrayAt(source: Record<string, unknown>, paths: string[][]): string[] {
  for (const path of paths) {
    const value = valueAtPath(source, path);

    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
    }
  }

  return [];
}

function valueAtPath(source: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = source;

  for (const segment of path) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}
