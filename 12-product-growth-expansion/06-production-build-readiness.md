# Production Build Readiness

## Purpose

This document translates the 24 new feature sets into production build scope. It is the handoff layer between product specs and implementation. It does not replace `11-technical-architecture`; any implementation that changes schema, APIs, events, providers, authorization, matching, notifications, payments, or infrastructure must update the matching architecture document in the same change.

## Global Implementation Invariants

1. Dating inventory remains Group-owned. No endpoint, screen, worker, or ranking job returns individual discovery inventory.
2. Complete verified Group eligibility remains the hard distribution gate.
3. Conversations remain group-owned. Breakouts are consent-gated child conversations.
4. Post-meetup interest remains private unless mutual. One-sided preference data requires explicit consent before ranking use.
5. Push and in-app notifications originate from persisted domain events only.
6. Paid capabilities are additive. They do not alter free baseline distribution or ranking weights.
7. Every active Group, Introduction, chat, Plan, pod, debrief, calendar, Moment, host, and recovery surface has a one-tap safety action.
8. Compatibility scores and reliability scores are internal ranking inputs only. They are never serialized to mobile clients as scores, labels, badges, or tiers.
9. The public domain for share, invite, Moment, cohort, and referral surfaces is `thenine.com`.

## Build Sequence

| Sequence | Feature set | Build dependency | Release recommendation |
|---:|---|---|---|
| 1 | First Introduction Launchpad | Existing group, verification, profile, Introduction APIs | Private alpha activation gate |
| 2 | Warm Group Invite Relay | Existing group invite APIs | Private alpha activation gate |
| 3 | Group Availability Mesh | Group availability schema and matching snapshots | Private alpha matching gate |
| 4 | Plan Fast Track | Availability Mesh, venue catalog, Plan APIs | Private alpha meetup gate |
| 5 | Meetup Momentum Hub | Domain events, notification inbox, Home state resolver | Private alpha retention gate |
| 6 | Debrief Learning Consent | Debrief and privacy settings | Private alpha data governance gate |
| 7 | Internal Group Reliability Ledger | Domain event outbox and matching snapshots | Seeded beta ranking experiment |
| 8 | Tonight Tables | Availability Mesh, Plan Fast Track, venue windows | Seeded beta city-rhythm pilot |
| 9 | Shareable Meetup Moment | Verified meetup, consented share token | Seeded beta PLG pilot |
| 10 | Vouch Signal Upgrade | Vouch moderation and profile approval | Seeded beta cold-start improvement |
| 11 | Breakout Bridge | Existing breakout requests and mutual edges | Seeded beta retention improvement |
| 12 | City Rhythm Calendar | Venue windows, pod slots, Calendar read model | Seeded beta city operations |
| 13 | Group Alumni Loops | Debrief outcomes, Moment suppression, Plan Fast Track | Seeded beta repeat loop |
| 14 | Host Accountability Kit | Social pods, host role, Plan checklist | Seeded beta pod quality |
| 15 | Thin-City Supply Builder | Matching empty states and operations aggregates | Seeded beta launch operations |
| 16 | Premium Plan Templates | Payments, entitlements, Plan metadata | Seeded beta monetisation pilot |
| 17 | Mutual Friend Follow-Up | Mutual edges, Plan Fast Track, Breakout Bridge | Post-beta retention |
| 18 | Calendar Import With Narrow Consent | Availability Mesh and provider adapter review | Post-beta friction reduction |
| 19 | Venue Quality Scorecard | Venue outcomes and safety review | Post-beta operations quality |
| 20 | Community Cohorts | Cohort consent and city launch operations | Post-beta acquisition |
| 21 | Group Preference Insights | Debrief consent and matching feature snapshots | Post-beta transparency |
| 22 | Concierge-Lite Planning | Staff case tooling and payment/refund flows | Post-beta premium service |
| 23 | Founder Host Network | Host Accountability Kit and operations staffing | Post-beta scalable hosts |
| 24 | Post-Safety Recovery Path | Safety actions, support, privacy-safe notifications | Post-beta trust retention |

## Domain Ownership Matrix

| Feature | Primary domain | Secondary domains | Scope classification |
|---|---|---|---|
| First Introduction Launchpad | Group | Verification, Introduction, Moderation, Safety | Member-acted, Group-scoped |
| Warm Group Invite Relay | Group | Member, Verification, Safety, Growth analytics | Group-scoped invite |
| Group Availability Mesh | Group | Matching, Plan, Notification | Group-scoped logistics |
| Plan Fast Track | Plan | Conversation, Venue, Safety, Notification | Conversation-to-Plan scoped |
| Meetup Momentum Hub | Notification | Group, Introduction, Plan, Debrief, Safety | Member view over Group state |
| Debrief Learning Consent | Debrief | Privacy, Matching, Safety | Member-scoped consent in Group context |
| Internal Group Reliability Ledger | Matching | Plan, Conversation, Debrief, Safety | Group-scoped internal scoring |
| Tonight Tables | Matching | Plan, Venue, Notification | Group-scoped time-sensitive inventory |
| Shareable Meetup Moment | Plan | Debrief, Media, Safety, Growth analytics | Plan-scoped share |
| Vouch Signal Upgrade | Group | Moderation, Matching | Group profile and trust |
| Breakout Bridge | Conversation | Debrief, Plan, Safety, Notification | Consent-gated child thread |
| City Rhythm Calendar | Plan | Venue, Matching, Entitlement, Safety | Group-scoped city opportunity |
| Group Alumni Loops | Debrief | Plan, Group, Growth analytics, Safety | Post-Plan Group loop |
| Host Accountability Kit | Plan | Social pod, Safety, Operations | Plan and staff scoped |
| Thin-City Supply Builder | Matching | Growth analytics, Group, Operations | Group demand and city operations |
| Premium Plan Templates | Entitlement | Plan, Payments, Venue, Safety | Paid Plan execution |
| Mutual Friend Follow-Up | Debrief | Plan, Conversation, Safety | Private mutual edge to Plan |
| Calendar Import With Narrow Consent | Group | Privacy, Provider adapters, Matching | Member consent to Group availability |
| Venue Quality Scorecard | Venue | Plan, Debrief, Safety, Operations | Internal venue quality |
| Community Cohorts | Growth | Group, Safety, Privacy, Operations | Member opt-in and Group supply |
| Group Preference Insights | Matching | Group, Debrief, Privacy | Group preference control |
| Concierge-Lite Planning | Plan | Staff, Payments, Safety, Venue | Paid staff-assisted Plan |
| Founder Host Network | Operations | Plan, Safety, Entitlement | Staff and host scoped |
| Post-Safety Recovery Path | Safety | Group, Plan, Support, Notification | Member recovery after safety state |

## Required Data Model Additions

These are proposed build targets. The production implementation must reconcile names and constraints into `11-technical-architecture/02-data-models.md`.

| Data object | Feature coverage | Required fields | Key constraints |
|---|---|---|---|
| `group_readiness_snapshots` | Launchpad | `group_id`, `member_id`, `blockers`, `next_action`, `computed_at` | Derived read model; no dating inventory by member. |
| `invite_relay_events` | Warm Invite | `invite_id`, `group_id`, `event_type`, `source_channel`, `occurred_at` | No broad contact storage; token expiry required. |
| `group_availability_snapshots` | Availability Mesh, Tonight, Plan Fast Track | `group_id`, `window_start`, `window_end`, `source`, `confirmed_by_member_ids`, `computed_at` | Group-level only; no raw calendar event metadata. |
| `plan_fast_track_proposals` | Plan Fast Track | `conversation_id`, `created_by_member_id`, `source_group_id`, `proposal_state`, `time_options`, `venue_options` | Proposal does not confirm Plan without RSVP rules. |
| `action_queue_items` | Momentum Hub | `member_id`, `group_id`, `source_event_id`, `target_type`, `target_id`, `deadline_at`, `status` | Must reference persisted source event where notification-eligible. |
| `debrief_learning_consents` | Debrief Learning Consent, Compatibility | `member_id`, `debrief_id`, `consent_version`, `status`, `revoked_at` | Decline cannot block safety or mutual reveal. |
| `group_reliability_snapshots` | Reliability Ledger | `group_id`, `model_version`, `features`, `computed_at` | Internal only; never serialized as score. |
| `recommendation_feature_snapshots` | Matching, Compatibility, Insights | `group_id`, `feature_version`, `features`, `consent_scope`, `computed_at` | Paid ranking inputs prohibited. |
| `matching_experiment_assignments` | Algorithm A/B plans | `group_id`, `experiment_key`, `variant`, `assigned_at` | Group-level randomization. |
| `tonight_table_entries` | Tonight Tables | `group_id`, `city_id`, `window_start`, `window_end`, `neighborhood_ids`, `status` | Both active members must confirm. |
| `meetup_moments` | Shareable Moment | `plan_id`, `group_id`, `token_hash`, `content_snapshot`, `status`, `expires_at` | Suppress when safety report exists; approval required. |
| `vouch_structured_tags` | Vouch Signal Upgrade | `vouch_id`, `group_id`, `subject_member_id`, `tag_code`, `approved_at` | Subject approval required; moderation applies. |
| `calendar_items` | City Rhythm Calendar | `city_id`, `item_type`, `venue_id`, `starts_at`, `ends_at`, `status`, `price_metadata` | Signup requires complete verified Group. |
| `calendar_item_saves` | City Rhythm Calendar | `calendar_item_id`, `group_id`, `member_id`, `status` | No notification without item state change. |
| `alumni_follow_up_requests` | Group Alumni, Mutual Friend Follow-Up | `source_plan_id`, `source_group_id`, `target_context`, `status`, `expires_at` | One-sided debrief interest never exposed. |
| `host_assignments` | Host Kit, Founder Host | `plan_id`, `host_member_id`, `host_group_id`, `status`, `accepted_at` | Host must be verified and eligible. |
| `host_checklist_items` | Host Kit | `plan_id`, `host_member_id`, `item_key`, `status`, `completed_at` | Staff audit for missed safety items. |
| `thin_city_demand_signals` | Supply Builder | `city_id`, `group_id`, `format`, `time_window`, `neighborhood_ids`, `action_type` | Operations export requires privacy thresholds. |
| `plan_templates` | Premium Templates, Concierge | `city_id`, `template_type`, `venue_id`, `price_metadata`, `terms_version`, `status` | Paid template does not affect matching rank. |
| `calendar_connections` | Calendar Import | `member_id`, `provider`, `status`, `scope_version`, `last_sync_at`, `revoked_at` | Store no event titles, attendees, notes, links, or raw locations. |
| `venue_quality_snapshots` | Venue Scorecard | `venue_id`, `model_version`, `signals`, `status`, `computed_at` | Internal only; safety suppression can hard-exclude. |
| `community_cohorts` | Community Cohorts | `city_id`, `name`, `partner_type`, `visibility_policy`, `status` | Cohort membership opt-in required. |
| `cohort_memberships` | Community Cohorts | `cohort_id`, `member_id`, `status`, `joined_at`, `left_at` | Do not expose membership publicly by default. |
| `group_preference_snapshots` | Preference Insights | `group_id`, `explicit_preferences`, `derived_preferences`, `consent_scope`, `updated_at` | Explicit settings override inferred preferences. |
| `concierge_cases` | Concierge-Lite | `group_id`, `conversation_id`, `plan_id`, `status`, `assigned_staff_id`, `payment_state` | Staff access limited and audited. |
| `founder_host_profiles` | Founder Host Network | `member_id`, `status`, `approved_by_staff_id`, `terms_version`, `suspended_at` | Host status never boosts dating ranking. |
| `host_plan_series` | Founder Host Network | `host_member_id`, `city_id`, `venue_id`, `schedule_rule`, `status` | Operations approval required. |
| `safety_recovery_actions` | Post-Safety Recovery | `member_id`, `source_safety_case_id`, `action_type`, `status`, `created_at` | Reporter choices private from reported parties. |

## API Surface Additions

All mutating routes require idempotency keys. These route groups are implementation targets and must be reconciled into `11-technical-architecture/03-api-spec.md`.

| Route group | Example routes | Auth and scope |
|---|---|---|
| Launchpad | `GET /v1/launchpad`, `POST /v1/groups/{groupId}/readiness-actions` | Member JWT; active Group access where applicable. |
| Invite Relay | `POST /v1/groups/{groupId}/invite-relay`, `POST /v1/group-invites/{token}/decline`, `POST /v1/group-invites/{token}/approval` | Group member, invitee, or inviter approval scope. |
| Availability Mesh | `GET /v1/groups/{groupId}/availability-mesh`, `PUT /v1/groups/{groupId}/availability-windows` | Active Group member. |
| Plan Fast Track | `POST /v1/conversations/{conversationId}/plan-fast-track`, `POST /v1/plan-proposals/{proposalId}/accept` | Conversation participant. |
| Momentum Hub | `GET /v1/action-queue`, `POST /v1/action-queue/{itemId}/dismiss` | Member JWT; dismiss only where policy allows. |
| Debrief Consent | `POST /v1/debriefs/{debriefId}/learning-consent`, `PATCH /v1/privacy/recommendation-learning` | Debrief owner or member privacy settings. |
| Reliability and Matching Admin | `GET /v1/admin/matching/feature-snapshots/{groupId}` | Staff only; audited access. |
| Tonight Tables | `POST /v1/groups/{groupId}/tonight-tables`, `GET /v1/groups/{groupId}/tonight-tables` | Active eligible Group. |
| Moments | `POST /v1/plans/{planId}/moments`, `PATCH /v1/moments/{momentId}`, `GET /v1/public/moments/{token}` | Plan participant for creation; public token for landing. |
| Structured Vouches | `POST /v1/groups/{groupId}/vouches/{vouchId}/tags`, `PATCH /v1/vouch-tags/{tagId}` | Group member and subject approval. |
| Calendar | `GET /v1/groups/{groupId}/city-calendar`, `POST /v1/calendar-items/{itemId}/save`, `POST /v1/calendar-items/{itemId}/join` | Active Group for join; eligibility required for Plan creation. |
| Alumni | `POST /v1/plans/{planId}/alumni-follow-ups`, `POST /v1/alumni-follow-ups/{requestId}/respond` | Plan participant or current Group member. |
| Hosts | `POST /v1/plans/{planId}/host-assignment`, `PATCH /v1/host-checklist-items/{itemId}` | Host, Plan participant, or staff depending route. |
| Thin City | `POST /v1/groups/{groupId}/thin-city-actions`, `GET /v1/admin/city-supply` | Group member for action; staff for aggregate dashboard. |
| Plan Templates | `GET /v1/plan-templates`, `POST /v1/plan-templates/{templateId}/apply` | Member JWT and active Group where applying. |
| Calendar Import | `POST /v1/calendar-connections`, `DELETE /v1/calendar-connections/{connectionId}`, `POST /v1/calendar-connections/{connectionId}/sync` | Member owner only. |
| Venue Scorecard | `GET /v1/admin/venues/{venueId}/scorecard`, `PATCH /v1/admin/venues/{venueId}/status` | Staff only; audited. |
| Cohorts | `POST /v1/cohorts/{code}/join`, `DELETE /v1/cohorts/{cohortId}/membership`, `GET /v1/admin/cohorts/{cohortId}/metrics` | Member opt-in; staff aggregate view. |
| Preference Insights | `GET /v1/groups/{groupId}/preference-insights`, `PATCH /v1/groups/{groupId}/preferences` | Active Group member; approval for material changes. |
| Concierge | `POST /v1/concierge/cases`, `PATCH /v1/concierge/cases/{caseId}`, `GET /v1/admin/concierge/cases` | Group member for request; staff for handling. |
| Founder Hosts | `POST /v1/host-applications`, `POST /v1/admin/host-applications/{applicationId}/decision`, `POST /v1/host-plan-series` | Member applicant, staff decision, approved host. |
| Safety Recovery | `GET /v1/safety/recovery`, `POST /v1/safety/recovery-actions` | Affected member only. |

## Domain Events And Notification Eligibility

All events are persisted in `domain_event_outbox` before realtime, push, analytics, or provider side effects.

| Event | Features | Push eligible? | Privacy scope |
|---|---|---|---|
| `group.readiness_changed` | Launchpad | Yes when blocker resolved or new required action exists | Group members |
| `invite.relay_opened` | Invite Relay | No by default | Inviter analytics only |
| `invite.relay_accepted` | Invite Relay | Yes | Group members |
| `group.availability_mesh_updated` | Availability Mesh | Yes only when active Plan or pending action affected | Group members |
| `plan.fast_track_proposed` | Plan Fast Track | Yes | Conversation participants |
| `action_queue.item_created` | Momentum Hub | In-app item; push only if source event eligible | Member private |
| `debrief.learning_consent_changed` | Debrief Consent | No unless user-facing privacy state changed | Member private |
| `matching.feature_snapshot_updated` | Reliability, Compatibility | No | Internal only |
| `tonight_table.entry_created` | Tonight | Yes after both Group members confirm | Group members |
| `moment.created` | Moments | No external push; in-app share prompt allowed | Plan participants |
| `vouch.tags_approved` | Vouch Upgrade | Yes if Group readiness changes | Group members |
| `calendar.item_changed` | Calendar | Yes for saved or joined item changes | Saved Groups or participants |
| `alumni.follow_up_requested` | Alumni, Mutual Friend | Yes | Relevant member or Group members |
| `host.assignment_changed` | Host Kit | Yes | Plan participants |
| `thin_city.demand_recorded` | Supply Builder | No | Internal aggregate |
| `plan.template_applied` | Premium Templates | Yes when Plan state changes | Plan participants |
| `calendar.connection_changed` | Calendar Import | No unless sync affects active Plan | Member private |
| `venue.quality_status_changed` | Venue Scorecard | Yes if active Plan affected | Plan participants |
| `cohort.membership_changed` | Cohorts | No unless cohort item becomes available by user action | Member private |
| `group.preferences_changed` | Preference Insights | Yes if approval required | Group members |
| `concierge.case_updated` | Concierge | Yes for meaningful case or Plan state | Group members |
| `host.profile_status_changed` | Founder Host | Yes for applicant | Member private |
| `safety.recovery_action_created` | Safety Recovery | Yes only if action state changes | Affected member private |

## Safety And Privacy Gates

| Gate | Applies to | Requirement before release |
|---|---|---|
| One-tap safety action | All active surfaces | Visible on every new screen in specs. |
| Reporter privacy | Safety Recovery, Venue, Hosts, Concierge, Cohorts | Reported parties cannot infer reporter choices. |
| Debrief privacy | Debrief Consent, Compatibility, Alumni, Mutual Friend | One-sided interest never exposed; consent required for ranking use. |
| Paid guardrail | Premium Templates, Concierge, Founder Hosts | Paid state not passed to ranking except additive stack size where already allowed. |
| Calendar minimization | Calendar Import | No raw event titles, attendees, notes, links, or locations persisted. |
| Cohort privacy | Community Cohorts | Membership hidden by default; aggregate thresholds for dashboards. |
| Moment privacy | Shareable Moment | Consent before share; no private interest or attendee identity without approval. |
| Host access | Host Kit, Founder Host | Hosts cannot see private debrief interest or safety case detail. |
| Staff audit | Venue, Concierge, Host, Safety Recovery | Staff actions and access logged. |
| Thin-city honesty | Supply Builder | No filler Groups, fake scarcity, or paid workaround. |

## Analytics Additions

These events extend `08-metrics/analytics-taxonomy.md` during implementation.

| Event family | New events |
|---|---|
| Launchpad | `launchpad_viewed`, `readiness_action_started`, `readiness_action_completed`, `readiness_blocker_resolved` |
| Invite Relay | `invite_relay_created`, `invite_relay_opened`, `invite_relay_declined`, `invite_relay_accepted`, `forwarded_invite_approval_required` |
| Availability | `availability_mesh_completed`, `availability_window_added`, `availability_import_connected`, `availability_import_revoked` |
| Planning | `plan_fast_track_opened`, `plan_fast_track_proposed`, `plan_fast_track_accepted`, `plan_template_applied` |
| Momentum | `action_queue_item_viewed`, `action_queue_item_completed`, `action_queue_item_expired` |
| Debrief learning | `debrief_learning_consent_granted`, `debrief_learning_consent_declined`, `debrief_learning_consent_revoked` |
| Matching | `recommendation_feature_snapshot_created`, `matching_experiment_assigned`, `compatibility_reason_served` |
| Tonight | `tonight_entry_created`, `tonight_opportunity_viewed`, `tonight_plan_confirmed` |
| Moments | `moment_prompt_viewed`, `moment_approved`, `moment_shared`, `moment_landing_opened`, `moment_signup_started` |
| Vouches | `vouch_tag_selected`, `vouch_tag_approved`, `vouch_tag_hidden` |
| Calendar | `calendar_item_viewed`, `calendar_item_saved`, `calendar_item_joined`, `calendar_item_canceled` |
| Alumni | `alumni_panel_viewed`, `alumni_follow_up_requested`, `alumni_follow_up_confirmed` |
| Hosts | `host_assigned`, `host_terms_accepted`, `host_checklist_completed`, `host_reported` |
| Thin city | `thin_city_state_viewed`, `thin_city_action_selected`, `thin_city_supply_gap_closed` |
| Venue | `venue_scorecard_updated`, `venue_suppressed`, `venue_replacement_selected` |
| Cohorts | `cohort_invite_opened`, `cohort_joined`, `cohort_left`, `cohort_plan_confirmed` |
| Preferences | `preference_insights_viewed`, `group_preference_changed`, `preference_change_approved` |
| Concierge | `concierge_offer_viewed`, `concierge_case_created`, `concierge_option_proposed`, `concierge_case_closed` |
| Founder hosts | `host_application_submitted`, `host_application_approved`, `host_plan_series_created` |
| Recovery | `safety_recovery_viewed`, `safety_recovery_action_selected`, `safe_restart_started` |

Analytics must not include raw debrief interest, raw report narrative, raw calendar event content, compatibility scores, or reliability scores.

## Required Test Gates

| Test area | Required assertions |
|---|---|
| Group-first distribution | No new route accepts `memberId` as dating inventory recipient; no solo discovery response shape exists. |
| Eligibility | Incomplete, unverified, paused, suspended, or moderation-held Groups cannot receive new Introductions, Tonight entries, Calendar joins, or cohort Plans. |
| Free baseline | Premium Templates, Concierge, Founder Hosts, and paid Calendar items do not reduce free baseline distribution. |
| Notification source | Every push or in-app notification intent references a persisted source event and dedupe key. |
| Debrief privacy | One-sided interest cannot be read by target, Group, host, concierge staff, analytics, public Moment, or ranking without consent. |
| Compatibility privacy | Compatibility and reliability scores are not serialized to client resources. |
| Calendar privacy | Raw calendar event content is discarded before persistence; revocation stops future sync. |
| Moment privacy | Moment cannot be created without required approvals; safety-suppressed Plans cannot generate Moments. |
| Host boundaries | Hosts cannot access private debrief interest or safety case detail; host reports suspend host tools by severity. |
| Staff audit | Concierge, venue, host, cohort, and safety recovery staff actions create audit logs. |
| Safety access | Each new active surface exposes report, block, leave, urgent help, or share-plan action as appropriate within one tap. |
| Thin-city honesty | Empty states never show incomplete Groups, unverified Members, fake cards, or paid upgrade as inventory fix. |
| Payment disclosure | Premium Plan and Concierge offers include price, renewal where relevant, cancellation, refund, venue costs, and exclusions. |
| Cohort privacy | Cohort membership is opt-in and hidden by default; dashboards enforce minimum aggregation thresholds. |
| Venue suppression | Suppressed venue is removed from Calendar and Plan suggestions; affected Plans reconfirm. |

## Feature Flag And Rollout Requirements

| Flag | Scope | Default |
|---|---|---|
| `launchpad_v1` | City and app version | On for alpha |
| `invite_relay_v1` | City and cohort | On for alpha |
| `availability_mesh_v1` | City and app version | On for alpha |
| `plan_fast_track_v1` | City and app version | On for alpha |
| `momentum_hub_v1` | City and app version | On for alpha |
| `debrief_learning_consent_v1` | City and privacy policy version | On for alpha |
| `reliability_ledger_v1` | Matching experiment | Off until beta experiment |
| `tonight_tables_v1` | City and neighborhood | Off until seeded beta |
| `meetup_moments_v1` | City and Plan safety status | Off until seeded beta |
| `vouch_tags_v1` | City and moderation capacity | Off until seeded beta |
| `city_calendar_v1` | City | Off until seeded beta |
| `premium_plan_templates_v1` | City and payment environment | Off until paid pilot |
| `calendar_import_v1` | Provider and platform | Off until privacy review |
| `cohorts_v1` | City and partner | Off until operations review |
| `concierge_lite_v1` | City and staff queue | Off until staffing ready |
| `founder_hosts_v1` | City and operations approval | Off until host pilot |
| `safety_recovery_v1` | Safety queue | Off until support readiness |

## Production Definition Of Done

A feature set is production-ready only when:

1. Product spec and architecture docs match implemented schema, API, events, and behavior.
2. Domain service enforces invariants, not only controllers or screens.
3. All mutating routes use idempotency keys.
4. State persists before realtime, push, analytics, provider, or payment side effects.
5. Safety action exists within one tap on every active surface.
6. Privacy and consent copy is implemented exactly for sensitive features.
7. Free baseline distribution guardrail tests pass.
8. One-sided debrief privacy tests pass.
9. State-change notification tests pass.
10. Staff access and audit tests pass where staff tools exist.
11. Mobile, API, worker, DB, and contract tests pass for touched domains.
12. Experiment or feature flag has rollback instructions.
13. Metrics dashboards or event validation exist for launch success and guardrails.
14. Operations and support runbooks are updated for safety, venue, host, paid, and concierge flows.

---
<!-- doc-version: 1.0 -->
