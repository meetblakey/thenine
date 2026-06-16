# Engineering Readiness

## Purpose

This package documents the main locks that must be closed before engineering starts building The Nine in production. It sits after the product, technical architecture, and product growth expansion docs.

## Current Documentation Setup

| Layer | Role |
|---|---|
| `00-strategy` through `10-appendices` | Product, research, experience, feature, content, safety, monetisation, growth, metrics, compliance, and appendix source of truth. |
| `11-technical-architecture` | Technical source of truth for stack, data, APIs, realtime, matching, media, verification, moderation, push, entitlements, security, infrastructure, and CI/CD. |
| `12-product-growth-expansion` | Full new-feature expansion plan, matching algorithm additions, compatibility model, and production build-readiness matrix. |
| `13-engineering-readiness` | Pre-engineering lock package. Engineering should not begin production build until these locks have named owners, final decisions, and evidence. |

The production brand used by this package is The Nine. Public web, support, privacy, and transactional email assumptions should resolve under `thenine.com`.

## Reading Order

1. `00-engineering-start-locks.md`
2. `01-architecture-reconciliation-lock.md`
3. `02-p0-vertical-slice-build-sequence.md`
4. `03-invariant-test-suite-lock.md`
5. `04-safety-operations-lock.md`
6. `05-privacy-consent-data-governance-lock.md`
7. `06-liquidity-launch-supply-lock.md`
8. `07-provider-environment-readiness-lock.md`
9. `08-analytics-instrumentation-lock.md`
10. `09-design-ux-qa-lock.md`
11. `10-rollout-kill-criteria-lock.md`
12. `11-legal-support-app-store-lock.md`
13. `12-engineering-start-checklist.md`

## Engineering Start Rule

Production engineering can start only when:

1. Each lock document has an accountable owner and decision state.
2. Architecture docs are reconciled with the selected P0 vertical slice.
3. Invariant tests are specified before implementation.
4. Safety operations, privacy consent, provider readiness, analytics, UX QA, liquidity, and kill criteria have objective evidence.
5. Legal, support, app-store, billing, age-gate, and `thenine.com` ownership are ready for the first release path.
6. Any unresolved item is explicitly classified as non-blocking for the first build slice.

---
<!-- doc-version: 1.0 -->
