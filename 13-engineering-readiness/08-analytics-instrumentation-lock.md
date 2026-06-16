# Analytics Instrumentation Lock

## Purpose

The Nine must instrument the core funnel before external users arrive. Analytics should measure verified real-world meetups, not generic session engagement, and must respect privacy boundaries for debrief, safety, calendar, cohort, and compatibility data.

## Authoritative Sources Reviewed

| Source | Relevance |
|---|---|
| `08-metrics/metrics-framework.md` | North-star metric, funnel targets, guardrails, review cadence. |
| `08-metrics/analytics-taxonomy.md` | Core objects, event families, required properties, dashboards. |
| `12-product-growth-expansion/06-production-build-readiness.md` | New analytics events and exclusions. |
| `09-compliance/privacy-and-data-policy.md` | Data minimization and sensitive data restrictions. |

## Required Dashboards Before Launch

| Dashboard | Required metrics |
|---|---|
| Activation | Account created, verification started/approved, Group created, invite sent/accepted, Group published, first Introduction. |
| Meetup funnel | Introduction shown, interest started, internal approval, mutual match, chat active, Plan proposed, Plan confirmed, attendance verified, debrief completed. |
| Safety | Reports by severity and surface, response SLA, protective actions, repeat reports, venue incidents. |
| Liquidity | Eligible Groups by neighborhood, Introduction availability, thin-city states, supply gaps, venue slots. |
| Notifications | Intent created, sent, held, suppressed, opened, action completed, opt-out. |
| Privacy and consent | Debrief learning consent granted/declined/revoked, calendar import connected/revoked, Moment approvals. |
| Monetisation guardrail | Paid conversion, refund, cancellation, paid feature impact on free Group conversion. |
| Provider health | Verification approvals/retries, moderation holds, push failures, payment webhooks, realtime errors. |

## Event Quality Rules

1. Events map to product objects: member, Group, Introduction, Conversation, Plan, Debrief, Safety Case, Venue, Cohort, or Purchase.
2. Group and Plan identifiers are required for meetup funnel events.
3. Safety and privacy events are access-controlled.
4. Analytics never includes raw debrief interest, raw report narrative, raw calendar event content, compatibility scores, reliability scores, or raw provider documents.
5. Paid feature analytics must include free-conversion guardrails.
6. Every event has owner, schema, sample payload, and dashboard destination.

## Acceptance Evidence

This lock is complete when:

1. Event dictionary exists for the first P0 vertical slice.
2. Dashboard definitions exist for activation, meetup funnel, safety, liquidity, notifications, and provider health.
3. Guardrail thresholds are configured for safety incidents, no-shows, verification drop-off, notification opt-out, and paid harm where applicable.
4. Privacy exclusions are tested in event payload validation.
5. Data review cadence is assigned for alpha and beta.

## Engineering Blockers

- Launching first cohort without activation and meetup funnel dashboards.
- Logging raw debrief interest or report narratives.
- Tracking sessions as primary success.
- No paid/free guardrail when paid features ship.
- No source/channel quality measurement for launch acquisition.

---
<!-- doc-version: 1.0 -->
