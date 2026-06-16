# Invariant Test Suite Lock

## Purpose

The invariant test suite must exist before production code starts. The product has several non-negotiable rules that cannot be left to implementation discipline or manual review.

## Authoritative Sources Reviewed

| Source | Relevance |
|---|---|
| `AGENTS.md` | Non-negotiable invariants and required implementation checklist. |
| `.cursorrules` | Do and do-not rules for code, naming, and architecture patterns. |
| `11-technical-architecture/13-ci-cd-pipeline.md` | Current required test gates. |
| `12-product-growth-expansion/06-production-build-readiness.md` | Expanded required assertions for new features. |

## Required Test Groups

| Test group | Required assertions |
|---|---|
| Group-first distribution | No dating inventory route accepts `memberId`; all Introduction sets are keyed by `recipientGroupId`; social-pod singles are modeled as Groups. |
| Group eligibility | Incomplete, unverified, moderation-held, safety-paused, or publish-unapproved Groups cannot receive Introductions, Tonight entries, Calendar joins, or Plan assignments. |
| Quartet rules | Quartet Groups require exactly two active verified members. |
| Conversation ownership | Group chats are owned by Groups; Breakouts are child conversations with parent context and accepted consent. |
| Debrief privacy | One-sided friend/crush/both signals are unreadable by targets, Groups, hosts, analytics, public shares, or staff outside audited safety need. |
| Recommendation consent | Post-meetup preference data is not used for ranking unless explicit consent exists and is active. |
| Paid guardrails | Paid state cannot reduce free baseline distribution or affect ranking weights. |
| Notification source | Every notification intent references a persisted domain event and dedupe key. |
| Safety access | Report, block, leave, urgent help, and share-plan actions exist within one tap on active risky surfaces. |
| Provider idempotency | Persona, Hive, OneSignal, RevenueCat, and Stripe integrations validate signatures and idempotency where applicable. |
| Staff audit | Staff access to moderation, safety, concierge, venue, host, or cohort data creates audit logs. |
| Calendar privacy | Calendar import never persists raw titles, attendees, notes, links, or locations. |
| Moment privacy | Public Moments require approvals and cannot reveal private interest or non-consenting attendee identity. |

## Test Inventory Contract

```typescript
export interface EngineeringInvariantTest {
  id: string;
  domain:
    | "group"
    | "matching"
    | "conversation"
    | "plan"
    | "debrief"
    | "safety"
    | "notification"
    | "entitlement"
    | "provider"
    | "staff"
    | "privacy";
  assertion: string;
  fixture: string;
  mustPassBefore: "merge" | "staging" | "production";
}
```

## Acceptance Evidence

This lock is complete when:

1. Test inventory exists for every test group above.
2. Each test has a fixture owner and expected failure mode.
3. CI/CD docs identify which checks block merge, staging, and production.
4. Invariant tests include negative cases, not only happy paths.
5. The first P0 vertical slice cannot merge without the group-first, debrief privacy, paid guardrail, and notification source tests.

Current implementation evidence: staff audit coverage now includes domain tests for role-scoped restricted access and API route tests proving `GET /v1/admin/safety/reports/{reportId}` persists a sanitized staff audit log before returning restricted report data. Future staff moderation, concierge, venue, host, and cohort routes must add equivalent audit tests in the same slice that introduces them.

The canonical invariant inventory lives in `packages/testing/src/invariant-inventory.ts`. It maps every required test group to its fixture owner, expected failure mode, required gate, and current evidence command. Expansion-only Moment privacy remains explicitly deferred until the Shareable Meetup Moment slice enters scope, with a production gate requirement.

## Engineering Blockers

- Future staff moderation, concierge, venue, host, and cohort routes must add equivalent audit tests in the same slice that introduces them.
- Moment privacy remains deferred because Shareable Meetup Moment is outside the first P0 vertical slice; it must not ship without approval and public-share privacy tests.

---
<!-- doc-version: 1.0 -->
