# Provider Environment Readiness Lock

## Purpose

Provider integrations are on the critical path for verification, moderation, realtime, push, payments, media, analytics, monitoring, and mobile release. Engineering should not start provider-backed production paths until sandbox behavior, webhook idempotency, secrets, failure modes, and observability are locked.

## Authoritative Sources Reviewed

| Source | Relevance |
|---|---|
| `11-technical-architecture/00-technology-stack-decision.md` | Provider choices and stack decisions. |
| `11-technical-architecture/06-media-pipeline.md` | S3, CloudFront, media processing, Hive moderation. |
| `11-technical-architecture/07-verification-integration.md` | Persona verification flow and status mapping. |
| `11-technical-architecture/08-moderation-pipeline.md` | Hive and human moderation workflow. |
| `11-technical-architecture/09-push-notification-service.md` | OneSignal transactional notification rules. |
| `11-technical-architecture/10-subscription-entitlement-service.md` | RevenueCat and Stripe flows. |
| `11-technical-architecture/12-infrastructure-and-environments.md` | AWS resources, queues, secrets, environments. |

## Provider Lock Matrix

| Provider or platform | Required lock |
|---|---|
| Persona | Sandbox inquiry creation, mobile SDK return, signed webhook, status mapping, retry, rejected, appeal, duplicate webhook. |
| Hive | Text and media classification, moderation hold/reject, timeout fallback, S1/S2 routing. |
| Ably | Scoped token generation, channel capabilities, reconnect replay, sequence skip recovery. |
| OneSignal | Transactional push only, quiet hours, dedupe, disabled category suppression, delivery receipt handling. |
| RevenueCat | Sandbox subscription, webhook idempotency, refund/cancel/expire, entitlement recompute. |
| Stripe | PaymentIntent, webhook idempotency, refund, dispute, safety withdrawal review. |
| S3 and CloudFront | Private upload, checksum validation, signed URL access, safety evidence retention. |
| PostHog | Event taxonomy, privacy exclusions, feature flag governance. |
| Sentry and Datadog | Error capture, queue metrics, safety SLO alerting, provider failure alerts. |
| EAS and app stores | Native SDK builds, environment config, release channel, push token handling. |

## Failure Mode Tests

| Failure | Expected behavior |
|---|---|
| Persona unavailable | Member can continue non-distribution setup; Group eligibility blocked. |
| Hive unavailable | Risky content held; safety reports still create cases. |
| Ably unavailable | API writes continue; clients recover via REST. |
| OneSignal unavailable | Intents queue; no synthetic makeup pings. |
| RevenueCat unavailable | Last-known entitlement state returned with clear unavailable purchase state. |
| Stripe webhook duplicated | Idempotency prevents double purchase or double refund. |
| S3 upload incomplete | Asset remains unavailable; no public media URL. |
| PostHog unavailable | Product state not blocked; events retry or drop by policy. |

## Acceptance Evidence

This lock is complete when:

1. Sandbox credentials and secrets exist for local, staging, and production where needed.
2. Webhook signature validation and idempotency are tested for each provider.
3. Provider failure modes are tested in staging.
4. No provider SDK state is used as sole source of truth.
5. Observability dashboards and alerts exist for verification, moderation, push, payments, realtime, media, and queues.
6. Provider data boundaries are documented for privacy and support.

Current Persona evidence: `apps/api/src/fastify-app.ts` creates the Fastify API shell and mounts `/healthz` plus the Persona webhook route with injected runtime ports. `apps/api/src/runtime-app.ts` composes that shell from a resolved `PERSONA_WEBHOOK_SECRET`, runtime clock/id generators, and a Postgres query client, then wires `createPersonaWebhookPostgresPersistence` into the webhook route. `apps/api/src/production-app.ts` reads `DATABASE_URL`, creates a node-postgres pool-backed query client through `apps/api/src/node-postgres-query-client.ts`, provides UUIDv7 runtime ids, and closes the pool with the Fastify app. `apps/api/src/persona-webhook-fastify-route.ts` registers the `/v1/webhooks/persona` Fastify route with raw JSON body capture and binds the configured webhook secret through `createPersonaWebhookDependencies`. `apps/api/src/persona-webhook-ingress.ts` extracts exactly one nonblank `Persona-Signature` header value and forwards the exact raw HTTP body to the raw-request handler. `apps/api/src/verification-route.ts` includes a raw-request webhook handler that verifies `rawRequestBody` before JSON parsing, then normalizes the parsed provider payload and reserves provider-event idempotency. `apps/api/src/persona-webhook-postgres-persistence.ts` supplies DB-backed ports that reserve `provider_webhook_events`, load `verification_cases` by Persona inquiry id, update `verification_cases` and `members`, insert `domain_event_outbox`, and mark the provider event processed transactionally. `apps/api/src/persona-webhook-dependencies.ts` binds a configured Persona webhook secret into the raw-body verifier while leaving persistence ports injectable. `apps/api/src/persona-adapter.ts` verifies `Persona-Signature` HMACs over timestamped raw request bodies before normalization, accepts matching `v1` candidates in Persona rotation headers, then normalizes Persona webhook payloads into the domain-safe `VerificationProviderEvent` shape. `apps/api/src/production-app.test.ts` proves the production app composes `DATABASE_URL`, resolved Persona webhook secret, node-postgres pool-backed persistence, UUIDv7 ids, and pool shutdown without raw provider artifacts entering persistence calls. `apps/api/src/node-postgres-query-client.test.ts` proves node-postgres pool queries and transaction clients commit, roll back, and release correctly for the persistence port. `apps/api/src/runtime-app.test.ts` proves the runtime composition uses the resolved Persona webhook secret and Postgres-backed persistence ports end to end, and fails closed without that secret. `apps/api/src/persona-webhook-postgres-persistence.test.ts` proves provider replay key reservation and transition persistence use the documented tables transactionally without raw provider payloads. `apps/api/src/fastify-app.test.ts` proves the API shell keeps the mounted Persona webhook route's raw-body signature verification intact. `apps/api/src/persona-webhook-fastify-route.test.ts` proves Fastify accepts the signed HTTP webhook only when the HMAC matches the exact raw payload and keeps raw provider artifacts out of persisted transitions. `apps/api/src/persona-webhook-ingress.test.ts` proves HTTP ingress passes exact raw bytes through and rejects ambiguous signature header values before verification. `apps/api/src/persona-webhook-dependencies.test.ts` proves signed raw bodies pass, tampered bodies reject, missing secrets fail at construction, and normalization still excludes raw provider artifacts. `apps/api/src/verification-route.test.ts` proves the raw-request handler verifies before parsing malformed JSON, keeps the parsed payload for normalization and provider-event idempotency, and prevents raw provider artifacts from entering persisted transitions. `apps/api/src/persona-adapter.test.ts` verifies valid, rotating, tampered, and stale signatures plus approved, retry, declined, unmapped, and incomplete payload handling while proving raw ID/liveness fields are excluded from the adapter output.

## Engineering Blockers

- Provider paths must continue to reject unsigned or unverified webhooks before normalization.
- The ECS/container startup command and live environment must be verified against real AWS-resolved `DATABASE_URL` and `PERSONA_WEBHOOK_SECRET` values before this path can be considered live-provider ready.
- Raw provider payloads must stay inside provider adapters and must not enter domain services.
- Push configured through marketing campaign tooling instead of Notification Service.
- Payment provider flows without refund and cancellation test cases.
- Media delivery paths that bypass signed URL authorization.

---
<!-- doc-version: 1.0 -->
