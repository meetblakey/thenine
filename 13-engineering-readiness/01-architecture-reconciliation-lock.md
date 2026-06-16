# Architecture Reconciliation Lock

## Purpose

Before engineering starts, the expansion plan must be reconciled into the technical source of truth. `12-product-growth-expansion` defines what to build; `11-technical-architecture` must define how the selected build slice is represented in schema, APIs, realtime events, matching, notifications, security, infrastructure, and CI/CD.

## Authoritative Sources Reviewed

| Source | Relevance |
|---|---|
| `AGENTS.md` | Requires architecture docs to update when schema, API, events, matching, providers, security, infra, or CI/CD change. |
| `11-technical-architecture/02-data-models.md` | Current tables, privacy boundaries, and constraints. |
| `11-technical-architecture/03-api-spec.md` | Current public API narrative and route conventions. |
| `11-technical-architecture/04-real-time-architecture.md` | Current channel model and domain event envelope. |
| `11-technical-architecture/05-matching-engine-design.md` | Current scoring model, hard filters, allocator, and explanation contract. |
| `11-technical-architecture/09-push-notification-service.md` | State-change-only notification rules. |
| `11-technical-architecture/11-security-model.md` | Authorization, data protection, threat model, staff access. |
| `12-product-growth-expansion/06-production-build-readiness.md` | Proposed schema, API, event, analytics, and test additions. |

## Required Decisions

| Decision | Required output | Blocking question |
|---|---|---|
| Slice scope | Exact P0 routes, tables, events, screens, and workers included in first build. | Which feature behaviors are in the first production slice? |
| Data model names | Final table names, indexes, constraints, retention class, and delete behavior. | Which proposed tables become canonical schema? |
| API contract | Routes, auth, request, response, errors, idempotency, pagination, and generated OpenAPI ownership. | Which API resources are stable for mobile? |
| Event catalog | Domain event names, payloads, sequence guarantees, realtime channel, push eligibility. | Which persisted state changes emit side effects? |
| Matching inputs | New feature snapshots, hard filters, reason codes, fairness and paid guardrails. | Which ranking changes are enabled in the first slice? |
| Security model | ABAC rules, staff roles, audit logs, sensitive data access. | Who can read or mutate each new resource? |
| Infrastructure | Queues, workers, secrets, provider callbacks, feature flags. | What infra exists before code depends on it? |
| CI/CD gates | Contract, migration, invariant, safety, privacy, and paid guardrail tests. | What blocks merge and production release? |

## Reconciliation Matrix

| Expansion area | Architecture docs to update before build |
|---|---|
| Launchpad and readiness | `02-data-models.md`, `03-api-spec.md`, `04-real-time-architecture.md`, `09-push-notification-service.md`, `11-security-model.md` |
| Invite Relay | `02-data-models.md`, `03-api-spec.md`, `04-real-time-architecture.md`, `08-moderation-pipeline.md`, `11-security-model.md` |
| Availability Mesh and Plan Fast Track | `02-data-models.md`, `03-api-spec.md`, `05-matching-engine-design.md`, `09-push-notification-service.md` |
| Debrief Learning Consent | `02-data-models.md`, `03-api-spec.md`, `05-matching-engine-design.md`, `11-security-model.md` |
| Reliability and compatibility | `02-data-models.md`, `05-matching-engine-design.md`, `11-security-model.md`, `13-ci-cd-pipeline.md` |
| Moments, cohorts, calendar, hosts, concierge | `02-data-models.md`, `03-api-spec.md`, `04-real-time-architecture.md`, `09-push-notification-service.md`, `11-security-model.md`, `12-infrastructure-and-environments.md` |
| Premium templates and payments | `02-data-models.md`, `03-api-spec.md`, `10-subscription-entitlement-service.md`, `09-compliance/subscription-and-consumer-protection.md` |
| Safety recovery and operations | `02-data-models.md`, `03-api-spec.md`, `08-moderation-pipeline.md`, `11-security-model.md` |

## Acceptance Evidence

This lock is complete when:

1. Every selected P0 table, route, event, worker, queue, channel, permission, and test gate is documented in `11-technical-architecture`.
2. Every architecture update has a matching product or policy reference.
3. No proposed schema or route exists only in `12-product-growth-expansion/06-production-build-readiness.md`.
4. Generated OpenAPI ownership is defined for new API routes.
5. Migration strategy is defined for each new table or enum.
6. No new route names dating inventory around members, swipes, likes, feeds, or boosts.
7. Reviewers sign off from product, engineering, trust and safety, privacy, and data.

## Engineering Blockers

- Missing canonical table names for consent, availability, action queue, or feature snapshots.
- API route lacks auth scope or idempotency rule.
- Domain event lacks payload, privacy scope, or notification eligibility.
- Staff access is described without audit behavior.
- Matching feature is described without paid/free and debrief privacy tests.
- Architecture docs disagree with feature specs.

---
<!-- doc-version: 1.0 -->
