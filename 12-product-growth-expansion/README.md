# Product Growth Expansion

## Purpose

This package specifies the complete new-feature expansion for The Nine before production build. It covers PLG, adoption, retention, DAU, matching quality, recommendation accuracy, compatibility, friction reduction, monetisation, safety, privacy, and implementation readiness while preserving the group-only product model.

## Reading Order

1. `00-prioritized-feature-backlog.md`
2. `01-p0-feature-specs.md`
3. `02-p1-feature-specs.md`
4. `05-p2-feature-specs.md`
5. `03-matching-recommendation-algorithm-design.md`
6. `04-compatibility-scoring-model.md`
7. `06-production-build-readiness.md`

## Scope Coverage

| Area | Covered in |
|---|---|
| Prioritized feature backlog | `00-prioritized-feature-backlog.md` |
| Full P0 specs | `01-p0-feature-specs.md` |
| Full P1 specs | `02-p1-feature-specs.md` |
| Full P2 specs | `05-p2-feature-specs.md` |
| Matching and recommendation algorithm | `03-matching-recommendation-algorithm-design.md` |
| Compatibility scoring and consent | `04-compatibility-scoring-model.md` |
| Production implementation readiness | `06-production-build-readiness.md` |

## Build Rule

Before implementation, reconcile every schema, API, realtime event, notification, payment, staff, matching, privacy, safety, analytics, infrastructure, and test change into `11-technical-architecture` and the relevant product, safety, compliance, metrics, and monetisation docs. This package is the planning source for the expansion; `11-technical-architecture` remains the technical source of truth during build.

## Pre-Engineering Locks

After this package is reviewed, use `../13-engineering-readiness` to close the architecture, test, safety, privacy, liquidity, provider, analytics, UX, rollout, legal, support, and app-store locks before production engineering starts.

---
<!-- doc-version: 1.0 -->
