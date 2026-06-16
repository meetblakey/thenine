# Privacy Consent And Data Governance Lock

## Purpose

The Nine's most sensitive growth and matching features depend on trust: debrief learning, compatibility scoring, calendar import, Moments, cohorts, hosts, concierge, and safety recovery. Engineering cannot start those paths until consent, retention, revocation, access, and deletion behavior are locked.

## Authoritative Sources Reviewed

| Source | Relevance |
|---|---|
| `09-compliance/privacy-and-data-policy.md` | Data minimization, invite privacy, group visibility, debrief privacy. |
| `09-compliance/ai-and-algorithmic-transparency.md` | Allowed and restricted AI/recommendation uses. |
| `09-compliance/subscription-and-consumer-protection.md` | Paid disclosure and cancellation requirements. |
| `11-technical-architecture/11-security-model.md` | Data protection, authorization, staff access, retention. |
| `12-product-growth-expansion/04-compatibility-scoring-model.md` | Consent model and data retention for compatibility. |
| `12-product-growth-expansion/05-p2-feature-specs.md` | Calendar import, cohorts, preference insights, concierge, recovery. |

## Consent Matrix

| Data or action | Default | Consent needed | Revocation behavior |
|---|---|---|---|
| Group profile publication | Private draft | All active Group members approve preview | Withdraw approval and remove from distribution. |
| Invite Relay | Invitee not visible | Invitee accepts and verifies | Non-joined invite data expires. |
| Availability | Manual entry | Group setup consent | Edit or clear future windows. |
| Debrief attendance | Prompted after Plan | Product use for attendance and safety | Retained under policy for meetup integrity. |
| Debrief learning | Off until consent | Explicit recommendation-learning consent | Stop future ranking use and mark derived features inactive. |
| One-sided interest | Private | Mutual reveal only, ranking use requires consent | Never exposed; ranking use stops on revocation. |
| Calendar import | Off | Provider-specific narrow consent | Stop sync and remove future imported windows unless converted to manual. |
| Moment share | Off | Required participant approval | Revoke token and public landing. |
| Cohort membership | Off | Member opt-in | Leave cohort; active Plans handled by policy. |
| Concierge staff access | Off | User request and case scope | Close case; audit retained. |
| Host tools | Off | Host terms acceptance | Suspend or revoke host status. |
| Safety recovery | Private | Affected member action | Recovery choices remain private from reported parties. |

## Data Governance Rules

1. Raw government ID and liveness data stay with Persona.
2. Raw calendar event titles, attendees, notes, links, and locations are never persisted.
3. Raw report narratives are restricted safety data, not analytics or ranking features.
4. Compatibility and reliability scores are internal and never serialized to clients.
5. Public Moments never include private interest, report state, or non-consenting attendee identity.
6. Cohort membership is hidden by default and aggregate dashboards require privacy thresholds.
7. Staff access to safety, debrief, concierge, host, venue, and cohort data is least-privilege and audited.

## Acceptance Evidence

This lock is complete when:

1. Consent copy and UI states are approved for every consented feature.
2. Data retention table exists for every new sensitive data object.
3. Revocation behavior is implemented in product, API, and worker flows.
4. Analytics exclusion rules are documented and testable.
5. Staff access matrix is documented and audited.
6. Deletion/export/correction implications are documented for new data objects.
7. Privacy review signs off before schema or provider integration work starts.

## Engineering Blockers

- Debrief-derived ranking features lack consent status.
- Calendar import stores raw event metadata.
- Moment sharing can be generated without all required approvals.
- Cohort dashboards expose small cohorts.
- Staff case tools expose private debrief interest by default.

---
<!-- doc-version: 1.0 -->
