# Metrics Framework

## North-Star Metric

**Verified real-world group meetups per weekly activated group.**

A verified real-world group meetup is a planned in-person meeting between eligible [APPNAME] groups or pod participants where attendance is corroborated through acceptable signals.

## Why This Metric

The research shows that dating users want outcomes, not more app sessions. Group dating only matters if it gets verified people into credible real-world social settings. This north star forces product, safety, growth, and monetization to optimize for the same outcome.

## Metric Definitions

| Metric | Definition | Measurement Approach | Seeded City Target |
|---|---|---|---|
| Weekly activated group | Complete verified group with at least one meaningful action in the last seven days | Group state and activity logs | 500 by beta month 3 |
| Verified real-world group meetup | Confirmed plan with corroborated attendance from required participants | RSVP, debrief, location/venue signal where available | 1.0 per weekly activated group per month by beta month 6 |
| Group creation rate | Verified users who create or join a complete group within 24 hours | Signup cohort analysis | 35%-50% |
| Invite acceptance rate | Accepted invites divided by sent invites | Invite funnel | 45%-65% |
| Verification completion rate | Users approved out of users who start verification | Verification funnel | 75%-90% depending on provider and market |
| Time to first introduction | Median hours from eligible group to first group card | Eligibility and introduction timestamps | Under 24 hours in dense cohorts; under 72 hours citywide |
| Introduction-to-match rate | Mutual group matches divided by shown introductions | Introduction and match records | 8%-15% |
| Match-to-plan rate | Group chats that create a plan poll or plan | Chat and planner records | 45%-60% |
| Plan confirmation rate | Proposed plans that receive required RSVPs | Planner records | 35%-50% |
| Confirmed plan-to-attended rate | Confirmed plans that become verified meetups | RSVP and debrief corroboration | 65%-80% |
| Pod RSVP-to-show rate | Pod RSVPs that attend | Pod attendance and debrief | 50%-70% |
| Debrief completion rate | Participants completing post-meetup check-in | Debrief prompt cohort | 60%-80% |
| Mutual edge rate | Meetups producing at least one mutual friend/crush/both edge | Debrief comparison | 25%-45% |

## Leading Indicators

- Verification start rate.
- Verification approval rate.
- Group invite send rate.
- Invite acceptance rate.
- Group profile completion rate.
- Introduction view-to-interest rate.
- Internal group approval rate.
- First message within 24 hours.
- Planner open rate.
- RSVP completion rate.

## Guardrail Metrics

| Guardrail | Definition | Target |
|---|---|---|
| Safety incident rate | Reports per 1,000 verified meetups, severity-adjusted | Downward trend; S1 near zero |
| Verification drop-off | Users starting but not completing verification | Below 25% after onboarding optimization |
| Group dissolution | Active groups that dissolve weekly | Below 20% |
| No-show rate | Confirmed attendees who do not attend or cancel late | Below 15% |
| Report response SLA | Reports handled within target by severity | 90%+ |
| Notification opt-out | Users disabling all notifications | Below 30% |
| Paid feature harm | Change in free group meetup conversion after paid launch | No negative statistically meaningful impact |
| Refund rate | Paid plan refunds | Below 10% for event products |

## Measurement Approach

- Use cohort analysis by launch channel, neighborhood, group type, and verification status.
- Attribute meetups to the group and plan objects, not individual sessions.
- Count a meetup as verified only when attendance evidence is corroborated.
- Separate quartet and pod funnels because they solve different jobs.
- Track safety, cancellation, and quality outcomes alongside conversion.
- Review metrics weekly during alpha and twice weekly during first public beta month.

## Format-Specific Funnels

### Quartet Funnel

1. Account created.
2. Verification approved.
3. Group complete.
4. Group profile published.
5. Introduction shown.
6. Group interest sent.
7. Mutual group match.
8. Group chat active.
9. Plan proposed.
10. Plan confirmed.
11. Meetup verified.
12. Debrief completed.
13. Mutual edge or next plan.

### Social Pod Funnel

1. Account created.
2. Verification approved.
3. Pod signup completed.
4. Pod assembled.
5. RSVP confirmed.
6. Venue revealed.
7. Attendance verified.
8. Debrief completed.
9. Mutual edge or repeat pod.

## Metric Review Cadence

- Daily: safety incidents, verification health, active plans, no-shows.
- Weekly: activation, group formation, meetup conversion, venue quality.
- Monthly: retention, paid conversion, launch channel quality, city expansion readiness.

---
<!-- doc-version: 1.0 -->
