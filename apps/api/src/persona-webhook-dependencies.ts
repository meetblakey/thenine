import {
  normalizePersonaWebhook,
  verifyPersonaWebhookSignature
} from "./persona-adapter.js";
import type { PersonaWebhookDependencies } from "./verification-route.js";

export interface PersonaWebhookDependencyConfig
  extends Pick<
    PersonaWebhookDependencies,
    "reserveProviderWebhookEvent" | "loadVerificationCaseByInquiryId" | "persistVerificationTransition"
  > {
  webhookSecret: string;
  now?: () => number;
  signatureToleranceSeconds?: number;
}

export function createPersonaWebhookDependencies(config: PersonaWebhookDependencyConfig): PersonaWebhookDependencies {
  const webhookSecret = config.webhookSecret.trim();

  if (webhookSecret === "") {
    throw new Error("Persona webhook secret is required.");
  }

  return {
    verifyPersonaSignature: async (rawRequestBody, signatureHeader) => {
      verifyPersonaWebhookSignature({
        rawBody: rawRequestBody,
        signatureHeader,
        secret: webhookSecret,
        ...(config.now === undefined ? {} : { now: config.now }),
        ...(config.signatureToleranceSeconds === undefined ? {} : { toleranceSeconds: config.signatureToleranceSeconds })
      });
    },
    normalizePersonaWebhook,
    reserveProviderWebhookEvent: config.reserveProviderWebhookEvent,
    loadVerificationCaseByInquiryId: config.loadVerificationCaseByInquiryId,
    persistVerificationTransition: config.persistVerificationTransition
  };
}
