import {
  handlePostPersonaWebhookRawRequest,
  type PersonaWebhookDependencies
} from "./verification-route.js";
import { ApiRouteError } from "./launchpad-route.js";

export interface PersonaWebhookHttpRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string | Buffer;
}

export async function handlePostPersonaWebhookHttpRequest(
  request: PersonaWebhookHttpRequest,
  dependencies: PersonaWebhookDependencies
): Promise<{ received: true }> {
  const signature = extractPersonaSignatureHeader(request.headers);

  return handlePostPersonaWebhookRawRequest({ signature }, request.rawBody, dependencies);
}

function extractPersonaSignatureHeader(headers: PersonaWebhookHttpRequest["headers"]): string {
  const signatureValues = Object.entries(headers)
    .filter(([name]) => name.toLowerCase() === "persona-signature")
    .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value !== "");

  const signature = signatureValues[0];

  if (signatureValues.length !== 1 || signature === undefined) {
    throw new ApiRouteError("PROVIDER_SIGNATURE_INVALID", "Persona webhook signature must be present exactly once.");
  }

  return signature;
}
