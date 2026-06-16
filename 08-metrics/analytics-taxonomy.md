# Analytics Taxonomy

## Taxonomy Principles

- Measure group progress, not only individual activity.
- Every event should map to a product object: member, group, introduction, chat, plan, pod, debrief, or safety case.
- Safety and privacy events should be access-controlled.
- Do not collect sensitive data that is not needed for product, safety, compliance, or measurement.

## Core Objects

| Object | Key Attributes |
|---|---|
| Member | Verification status, city, age band, notification settings, acquisition source |
| Group | Group status, city, neighborhood range, intent, availability, member count |
| Introduction | Source group, target group, recommendation reason categories, shown time, action |
| Chat | Chat type, participant groups, status, message count, planner status |
| Plan | Plan type, venue type, RSVP state, confirmed time, attendance state |
| Pod | Pod size, neighborhood, host status, venue, RSVP and show rate |
| Debrief | Attendance, quality, interest signals, safety flags |
| Safety Case | Category, severity, surface, status, response time |
| Subscription or Purchase | Package, renewal state, cancellation reason, refund state |

## Event Families

| Family | Example Events | Purpose |
|---|---|---|
| Onboarding | account_created, verification_started, verification_approved, standards_accepted | Measure trust gate and activation |
| Group formation | group_created, invite_sent, invite_accepted, group_published, group_paused | Measure atomic unit creation |
| Discovery | introductions_loaded, group_card_viewed, group_interest_started, group_interest_approved, group_passed | Measure bounded matching quality |
| Match and chat | group_match_created, group_chat_opened, message_sent, prompt_used, chat_expired | Measure conversation health |
| Planning | planner_opened, plan_poll_created, plan_voted, rsvp_confirmed, plan_confirmed, plan_canceled | Measure meetup coordination |
| Attendance | meetup_checkin_sent, attendance_confirmed, meetup_verified, no_show_recorded | Measure north-star integrity |
| Debrief | debrief_started, interest_signal_submitted, mutual_edge_created, quality_rating_submitted | Measure post-meetup outcomes |
| Safety | report_started, report_submitted, block_confirmed, leave_group_confirmed, safety_case_resolved | Measure safety access and response |
| Monetization | paywall_viewed, purchase_started, purchase_completed, subscription_canceled, refund_processed | Measure paid value and consumer protection |
| Notifications | notification_sent, notification_opened, notification_action_completed, notification_disabled | Measure state-change utility |

## Required Event Properties

| Property | Applies To | Notes |
|---|---|---|
| city | All major events | Required for city launch analysis. |
| group_id | Group, discovery, chat, plan, debrief | Primary unit of product progress. |
| member_id | Member-level events | Must respect privacy and access control. |
| plan_id | Planning, attendance, debrief | Needed for north-star verification. |
| pod_id | Pod events | Separate from quartet group flows. |
| source | Acquisition and entry events | Creator, referral, venue, waitlist, paid, organic. |
| surface | Safety and action events | Profile, chat, plan, debrief, settings. |
| status | State-change events | Pending, approved, failed, expired, confirmed, canceled. |
| reason_category | Pass, cancel, report, refund | Use controlled categories plus optional text where safe. |

## Dashboards

### Activation Dashboard

- Verification funnel.
- Group creation funnel.
- Invite acceptance.
- Group publish rate.
- Time to first introduction.

### Meetup Funnel Dashboard

- Introduction-to-interest.
- Interest-to-match.
- Match-to-plan.
- Plan-to-confirmation.
- Confirmation-to-attendance.
- Attendance-to-debrief.

### Safety Dashboard

- Reports by severity and surface.
- Response SLA.
- Repeat offender patterns.
- Venue incident rate.
- Block and leave usage.

### City Health Dashboard

- Active groups by neighborhood.
- Introduction inventory balance.
- Meetup density.
- Venue quality.
- Channel quality by meetup conversion.

### Monetization Dashboard

- Paid conversion after first meetup.
- Revenue per activated group.
- Refunds and cancellations.
- Paid feature impact on free conversion.

---
<!-- doc-version: 1.0 -->
