import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ApiRouteError, type ApiErrorCode } from "./launchpad-route.js";
import {
  createPersonaWebhookDependencies,
  type PersonaWebhookDependencyConfig
} from "./persona-webhook-dependencies.js";
import { handlePostPersonaWebhookHttpRequest } from "./persona-webhook-ingress.js";

export interface PersonaWebhookFastifyRouteConfig extends PersonaWebhookDependencyConfig {
  routePath?: string;
}

export async function registerPersonaWebhookFastifyRoute(
  app: FastifyInstance,
  config: PersonaWebhookFastifyRouteConfig
): Promise<void> {
  const routePath = config.routePath ?? "/v1/webhooks/persona";
  const dependencies = createPersonaWebhookDependencies(config);

  await app.register(async (personaWebhookScope) => {
    personaWebhookScope.removeContentTypeParser("application/json");
    personaWebhookScope.addContentTypeParser("application/json", { parseAs: "buffer" }, (_request, body, done) => {
      done(null, body);
    });

    personaWebhookScope.post(routePath, async (request, reply) => {
      try {
        return await handlePostPersonaWebhookHttpRequest(
          {
            headers: request.headers,
            rawBody: requireRawWebhookBody(request)
          },
          dependencies
        );
      } catch (error) {
        return sendApiRouteError(reply, request.id, error);
      }
    });
  });
}

function requireRawWebhookBody(request: FastifyRequest): string | Buffer {
  if (typeof request.body === "string" || Buffer.isBuffer(request.body)) {
    return request.body;
  }

  throw new ApiRouteError("VALIDATION_ERROR", "Persona webhook body must be captured as raw bytes.");
}

function sendApiRouteError(reply: FastifyReply, requestId: string, error: unknown): FastifyReply {
  if (error instanceof ApiRouteError) {
    return reply.status(statusForApiError(error.code)).send({
      error: {
        code: error.code,
        message: error.message,
        requestId
      }
    });
  }

  return reply.status(500).send({
    error: {
      code: "UNPROCESSABLE_STATE" satisfies ApiErrorCode,
      message: "Unexpected API route failure.",
      requestId
    }
  });
}

function statusForApiError(code: ApiErrorCode): number {
  if (code === "PROVIDER_SIGNATURE_INVALID" || code === "UNAUTHENTICATED") {
    return 401;
  }

  if (code === "FORBIDDEN" || code === "GROUP_ACCESS_DENIED") {
    return 403;
  }

  if (code === "NOT_FOUND") {
    return 404;
  }

  if (code === "CONFLICT" || code === "IDEMPOTENCY_CONFLICT") {
    return 409;
  }

  if (code === "RATE_LIMITED") {
    return 429;
  }

  return 400;
}
