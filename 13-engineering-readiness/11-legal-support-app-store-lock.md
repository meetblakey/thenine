# Legal Support And App Store Lock

## Purpose

The Nine cannot enter production build with only product and technical readiness. The first release also needs legal terms, support operations, billing handling, app-store readiness, age controls, and domain/email ownership locked so the app can safely handle real users, payments, disputes, appeals, and platform review.

## Authoritative Sources Reviewed

| Source | Relevance |
|---|---|
| `09-compliance/privacy-and-data-policy.md` | Privacy notices, data rights, consent, deletion, and minimization. |
| `09-compliance/subscription-and-consumer-protection.md` | Subscription, refund, cancellation, and consumer disclosure expectations. |
| `05-safety/incident-response.md` | Safety support escalation, user communication, and severity response. |
| `05-safety/moderation-policy.md` | Enforcement, appeals, prohibited conduct, and review standards. |
| `11-technical-architecture/07-verification-integration.md` | Verification statuses, rejected states, appeals, provider data boundaries. |
| `11-technical-architecture/10-subscription-entitlement-service.md` | RevenueCat, Stripe, entitlement recompute, refund, and cancellation behavior. |
| `11-technical-architecture/12-infrastructure-and-environments.md` | Environment ownership, secrets, DNS, monitoring, and production access controls. |

## Required Decisions

| Area | Required lock before production build |
|---|---|
| Brand and domain | `thenine.com` ownership, DNS control, transactional email domain, support email, security contact, privacy contact. |
| Legal entity and insurance | Contracting entity, payment merchant identity, cyber/privacy coverage, event or venue liability review. |
| Age gate | 18+ eligibility rule, rejected-underage flow, data deletion behavior, app-store age rating. |
| Terms and privacy notices | Terms of service, privacy policy, community guidelines, safety policy, subscription terms, data-rights instructions. |
| App-store review | iOS and Android metadata, privacy nutrition labels/data safety forms, subscription disclosures, verification SDK explanation. |
| Support taxonomy | Categories for verification, invite, Group, Plan, safety, billing, account, privacy, technical, and venue issues. |
| Support SLAs | First-response targets by category, safety escalation handoff, weekend/event-night coverage. |
| Verification appeals | Rejected, duplicate, expired, and manual-review paths with provider boundaries and user copy. |
| Billing support | Refund, cancellation, chargeback, failed payment, entitlement mismatch, venue payment dispute. |
| Data rights | Access, deletion, correction, export, consent revocation, and retained safety-record exceptions. |
| Law enforcement and emergency | Emergency disclaimer, lawful request intake, data preservation policy, staff approval chain. |

## Required Support States

| Surface | Support state |
|---|---|
| Verification | Pending, failed, rejected, retry, appeal submitted, appeal resolved. |
| Invite Relay | Invite expired, invite declined, inviter removed, invitee already verified, unsafe invite report. |
| Group eligibility | Missing member, moderation hold, profile rejected, unavailable city, safety pause. |
| Plan | RSVP dispute, cancellation, venue issue, no-show, safety concern, refund request. |
| Debrief | Missed prompt, attendance dispute, consent revocation, safety report, mutual reveal issue. |
| Billing | Purchase failed, entitlement missing, refund requested, renewal cancelled, disputed charge. |
| Privacy | Data export, deletion, correction, consent revocation, account closure. |

## Acceptance Evidence

This lock is complete when:

1. `thenine.com` DNS, support, privacy, and transactional email ownership are documented.
2. Legal entity, merchant identity, insurance review, and app-store account ownership are documented.
3. Terms, privacy policy, community guidelines, safety policy, and subscription terms are approved.
4. Age gate, app-store age rating, and underage rejection/deletion paths are approved.
5. Support taxonomy, SLAs, macros, escalation paths, and weekend/event-night coverage are documented.
6. Verification appeal, billing support, privacy request, and lawful request workflows are documented.
7. App-store privacy forms and subscription disclosures match the actual data model and paid features.

## Engineering Blockers

- App stores or payment providers are configured under a temporary or personal entity.
- `thenine.com` email or DNS is not controlled before transactional flows are implemented.
- Support cannot handle verification rejections, billing disputes, or privacy deletion requests.
- Age gate and underage data deletion behavior are undefined.
- Terms, privacy policy, safety policy, or subscription disclosures do not match planned product behavior.

---
<!-- doc-version: 1.0 -->
