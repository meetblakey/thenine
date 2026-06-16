# Safety Operations Lock

## Purpose

The Nine cannot run real-world meetups until safety operations are staffed, scoped, and measurable. Product safety controls are not enough without response coverage, moderation authority, incident routing, and support procedures.

## Authoritative Sources Reviewed

| Source | Relevance |
|---|---|
| `05-safety/safety-model.md` | Safety layers, surface requirements, risk categories, metrics. |
| `05-safety/incident-response.md` | Severity definitions, first response targets, protective actions. |
| `05-safety/moderation-policy.md` | Prohibited conduct, enforcement actions, review standards. |
| `11-technical-architecture/08-moderation-pipeline.md` | Automated and human moderation architecture. |
| `11-technical-architecture/11-security-model.md` | Staff access, audit, data protection, threat model. |
| `12-product-growth-expansion/06-production-build-readiness.md` | Safety gates for new surfaces. |

## Required Decisions

| Decision | Required output |
|---|---|
| Coverage model | Named coverage windows for alpha, beta, weekends, and event nights. |
| Severity routing | S1, S2, S3, S4 owners, escalation paths, and backup owner. |
| Protective action authority | Who can hide reporter, pause Group, disable chat, cancel Plan, suppress venue, suspend account. |
| Moderator console scope | Which evidence bundles moderators can see and what remains restricted. |
| Reporter communication | Copy and timing for report received, protective action, case update, and resolution. |
| Venue escalation | How unsafe venue reports reach operations and when venue suppression applies. |
| Post-incident review | Required review template for every S1 and recurring S2. |

## Operational Minimums

| Area | Minimum before first real meetup |
|---|---|
| S1 coverage | 30-minute first response target with backup escalation. |
| S2 coverage | 12-hour first response target with daily queue review. |
| Evidence preservation | Report, chat, Plan, venue, profile, and debrief context preserved under access controls. |
| Staff audit | Every staff view and action on safety-sensitive data logged. |
| Safety copy | User-facing emergency guidance states The Nine is not emergency services. |
| Plan safety | Share Plan available from confirmed Plan and Safety Center. |
| Surface audit | Profile, Group card, chat, Breakout, Plan, pod, venue, debrief, Moment, host, and recovery surfaces have safety actions. |

## Acceptance Evidence

This lock is complete when:

1. Safety queue staffing model is documented with named roles.
2. Moderator decision rubric maps risk categories to enforcement actions.
3. S1/S2 paging and backup paths are tested in staging.
4. Staff console access is role-scoped and audited.
5. Safety surface audit covers every screen in `02-experience/screen-inventory.md` and `12-product-growth-expansion`.
6. Incident response copy is approved by product, legal/privacy, and trust and safety.
7. Venue suppression and Plan reconfirmation procedures are documented.

## Engineering Blockers

- No staffed S1 path before any confirmed meetup feature ships.
- Report routes exist but protective actions are manual or undefined.
- Staff can view debrief interest without audited safety scope.
- Venue reports do not trigger operations review.
- Safety action is hidden behind multi-step menus on active surfaces.

---
<!-- doc-version: 1.0 -->
