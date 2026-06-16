# Engineering Start Checklist

## Purpose

This checklist is the final gate before production engineering starts. It converts the readiness locks into a single go/no-go artifact.

## Checklist

| Item | Required evidence | State |
|---|---|---|
| Documentation setup understood | `README.md`, `AGENTS.md`, `11-technical-architecture`, `12-product-growth-expansion`, and `13-engineering-readiness` reviewed. | open |
| Architecture reconciliation locked | Selected P0 slice reflected in data, API, realtime, matching, notification, security, infra, and CI/CD docs. | open |
| P0 vertical slice locked | Scope approved and deferred features documented. | open |
| Invariant tests locked | Group-first, eligibility, debrief privacy, paid guardrail, notification source, safety access tests specified. | open |
| Safety operations locked | S1/S2 coverage, protective actions, moderator scope, venue escalation, reporter communication documented. | open |
| Privacy and consent locked | Consent matrix, retention, revocation, staff access, analytics exclusions documented. | open |
| Liquidity launch supply locked | City, neighborhoods, founding Groups, venues, pod slots, safety coverage documented. | open |
| Provider readiness locked | Sandbox credentials, webhooks, idempotency, failure modes, observability documented. | open |
| Analytics locked | Event dictionary, dashboards, guardrails, privacy exclusions documented. | open |
| Design and UX QA locked | Critical screen states, copy, safety placement, privacy comprehension documented. | open |
| Rollout and kill criteria locked | Stage gates, pause criteria, kill switches, rollback paths documented. | open |
| Legal, support, and app-store readiness locked | `thenine.com`, legal entity, age gate, terms, privacy, support SLAs, app-store disclosures, billing and data-rights workflows documented. | open |
| Owners assigned | Product, engineering, safety, privacy, data, operations, support, legal, finance, growth, and app-store release owners assigned. | open |
| Open risks triaged | Any remaining open item classified as blocker, non-blocker, or deferred with owner. | open |

## Go/No-Go Rule

Engineering can start only when every `State` above is changed from `open` to `locked` or `deferred` with a written rationale. A blocker cannot be deferred if it affects group-first distribution, verification, debrief privacy, safety action access, paid guardrails, notification source integrity, provider webhook integrity, legal launch eligibility, support escalation, app-store compliance, or production rollback.

---
<!-- doc-version: 1.0 -->
