# Rollout And Kill Criteria Lock

## Purpose

Before beta or production launch, The Nine needs objective criteria for starting, pausing, rolling back, or killing a rollout. This protects users, preserves trust, and prevents teams from rationalizing unsafe or low-quality signals after launch.

## Authoritative Sources Reviewed

| Source | Relevance |
|---|---|
| `00-strategy/roadmap.md` | Phase exit criteria and launch goals. |
| `07-growth/city-launch-playbook.md` | Alpha cadence, thresholds, and risks. |
| `08-metrics/metrics-framework.md` | Guardrail metrics and targets. |
| `11-technical-architecture/13-ci-cd-pipeline.md` | Deploy, rollback, and production approval paths. |
| `05-safety/incident-response.md` | S1-S4 severity and response targets. |

## Rollout Stages

| Stage | Entry criteria | Exit criteria |
|---|---|---|
| Internal staging | Architecture reconciled, provider sandbox ready, invariant tests specified. | P0 smoke path passes with synthetic data. |
| Staff dogfood | Safety ops staffed, provider staging stable, UX QA complete. | No blocker safety/privacy findings and core funnel works. |
| Private alpha | Launch cohort, venue coverage, safety coverage, analytics dashboards ready. | 35% Group creation in 24 hours, 20% Introduction-to-confirmed-meetup in 14 days, no unresolved S1. |
| Seeded beta | Supply targets and first alpha guardrails healthy. | Stable meetup conversion, safety SLA, debrief completion, no paid harm. |
| Public beta | City density, support capacity, provider SLOs, kill criteria rehearsed. | Phase roadmap targets or city expansion readiness. |

## Kill Or Pause Criteria

| Area | Pause or kill trigger | Default action |
|---|---|---|
| S1 safety | Any unresolved S1 beyond SLA or repeated S1 pattern | Pause affected surface or city cohort; incident review. |
| Safety reporting | Protective actions not applying reliably | Disable affected interaction and route to support. |
| Verification | Approval or retry flow fails at provider or mapping layer | Block distribution; keep non-distribution setup. |
| Matching integrity | Incomplete or unverified Group appears in inventory | Stop matching run; invalidate affected sets. |
| Debrief privacy | One-sided interest exposed or serialized incorrectly | Disable debrief result surface; incident response. |
| Paid guardrail | Free Group meetup conversion meaningfully drops after paid launch | Disable paid feature or experiment. |
| Notification integrity | Push created without persisted source event | Disable notification category and audit intents. |
| No-show | Confirmed Plan no-show rate exceeds 15% without mitigation | Pause high-risk Plan source and review reliability. |
| Venue safety | Venue incident pattern or severe venue report | Suppress venue and reconfirm affected Plans. |
| Provider reliability | Provider outage blocks core flow beyond defined fallback | Use fallback or pause affected route. |
| Privacy | Raw restricted data appears in analytics, logs, or public share | Disable affected pipeline and run privacy incident review. |

## Rollback Requirements

| Component | Required rollback path |
|---|---|
| Feature flags | Every new feature has city/cohort kill switch. |
| Matching | Disable new model version and reuse prior daily set generation. |
| Push | Disable template/category in Notification Service, not provider marketing tool. |
| Payments | Pause offer, preserve purchase ledger, support refund/credit. |
| Mobile | Remote config only for non-critical UI; store hotfix path for critical bugs. |
| Workers | Pause queue, deploy previous worker, replay DLQ after fix. |
| Database | Prefer forward fix; destructive rollback only under incident procedure. |

## Acceptance Evidence

This lock is complete when:

1. Every rollout stage has named owner, entry criteria, exit criteria, and stop criteria.
2. Kill switches are mapped to feature flags and operational owners.
3. Safety, privacy, matching, notification, and paid incidents have default pause actions.
4. Dashboards can surface every kill criterion.
5. Incident tabletop is completed before first real meetup cohort.

## Engineering Blockers

- Launching without city or cohort kill switches.
- No dashboard for S1/S2 SLA, no-show rate, debrief privacy, or paid harm.
- Matching model cannot be rolled back independently.
- Push templates can only be controlled through marketing tooling.
- Payment feature lacks refund and safety withdrawal path.

---
<!-- doc-version: 1.0 -->
