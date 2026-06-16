# Prioritized Feature Backlog

| Feature | Priority | Category | One-line description | Expected impact | Complexity | Build order |
|---|---|---|---|---|---|---:|
| First Introduction Launchpad | P0 | Adoption and onboarding | A group-owned readiness path that gets members from verification to first eligible Introduction with the fewest required decisions. | Higher verified-to-complete-group conversion, lower onboarding abandonment, faster time to first value. | Medium | 1 |
| Warm Group Invite Relay | P0 | PLG and viral | Privacy-safe invite relay that helps a member recruit the right friend, lets the invitee preview the group, and attributes downstream group formation. | Higher invite acceptance, stronger referral coefficient, fewer stalled draft groups. | Medium | 2 |
| Group Availability Mesh | P0 | Matching and friction reduction | A shared availability model that turns member windows into group-level overlap used for matching, planning, and real-world rhythm surfaces. | Better recommendation accuracy, higher match-to-plan conversion, fewer scheduling stalls. | High | 3 |
| Plan Fast Track | P0 | Friction reduction | One-tap plan creation from chat using availability overlap, venue fit, RSVP quorum, and safety sharing. | Higher planner open-to-confirmed-plan conversion and shorter match-to-plan time. | High | 4 |
| Meetup Momentum Hub | P0 | DAU and retention | A Home and chat action hub showing only concrete group, plan, Introduction, RSVP, safety, and debrief state changes. | More daily active groups without generic re-engagement, higher deadline completion. | Medium | 5 |
| Debrief Learning Consent | P0 | Matching quality and retention | Explicit consent layer that lets private post-meetup quality and preference data improve future recommendations without exposing one-sided interest. | Better ranking signal quality, higher repeat meetup relevance, stronger trust. | Medium | 6 |
| Internal Group Reliability Ledger | P1 | Matching quality and safety | Internal-only reliability model from reply speed, planning engagement, RSVP follow-through, attendance, cancellations, and reports. | Fewer dead chats, fewer no-shows, higher confirmed meetup quality. | High | 7 |
| Tonight Tables | P1 | Retention and adoption | Time-boxed real-world opportunities for groups explicitly available tonight or this weekend, still bounded and group-owned. | More high-intent opens, faster first meetup, better use of weekend rhythms. | High | 8 |
| Shareable Meetup Moment | P1 | PLG and viral | Opt-in post-meetup share card at thenine.com that celebrates the group plan without revealing private interest or attendee identity beyond consent. | New invite demand after real-world value, stronger social proof, higher K-factor. | Medium | 9 |
| Vouch Signal Upgrade | P1 | Compatibility and trust | Structured vouch prompts capture friend-authored sentiment categories for ranking reasons and profile clarity. | Better card comprehension, better cold-start signals, more interest starts. | Medium | 10 |
| Breakout Bridge | P1 | Retention and friction reduction | Contextual, consent-gated breakout requests triggered by confirmed plans, mutual debrief edges, or balanced group-chat engagement. | More natural romantic follow-through without collapsing into solo discovery. | Medium | 11 |
| City Rhythm Calendar | P1 | DAU and real-world rhythm | A local calendar of verified venue windows, partner plans, and host-led pods matched to group availability. | More recurring reasons to open, better venue fill, higher pod assembly. | High | 12 |
| Group Alumni Loops | P1 | Retention and PLG | After a meetup, groups can plan again, invite another group, or re-form with explicit consent and history boundaries. | Higher repeat activation, stronger friend-network expansion, less post-meetup drop-off. | Medium | 13 |
| Host Accountability Kit | P1 | Safety and retention | Role tools for social-pod hosts and group coordinators: expectations, checklist, reconfirmation, no-show handling, and safety escalation. | Higher pod RSVP-to-show, fewer coordination failures, clearer accountability. | Medium | 14 |
| Thin-City Supply Builder | P1 | Growth and matching | Honest no-inventory state that converts demand into neighborhood/time/group-format supply signals and friend-pair recruitment. | Better launch-density operations, lower disappointment, more complete groups in sparse cohorts. | Medium | 15 |
| Premium Plan Templates | P1 | Monetisation and friction reduction | Paid, transparent plan templates for premium coordination and partner venues, adding convenience without changing distribution ranking. | Revenue after first value, higher plan confirmation, no free-tier harm. | Medium | 16 |
| Mutual Friend Follow-Up | P2 | Retention | Private friend mutual edges create group-friendly follow-up plans, not just romantic breakouts. | More positive outcomes when romance is absent, higher repeat pod/group use. | Medium | 17 |
| Calendar Import With Narrow Consent | P2 | Friction reduction | Optional calendar read windows that convert busy schedules into availability without storing broad calendar content. | Lower scheduling effort for high-intent users. | High | 18 |
| Venue Quality Scorecard | P2 | Matching quality and safety | Internal venue reliability model from safety, no-show, noise, cost, accessibility, attendance, and debrief quality. | Better plan fit and fewer venue-related incidents. | Medium | 19 |
| Community Cohorts | P2 | PLG and adoption | Verified cohort entry for graduate programs, alumni networks, creator communities, and hobby groups with explicit privacy boundaries. | Better city seeding and trust through dense communities. | High | 20 |
| Group Preference Insights | P2 | Matching quality | Post-meetup and pass-pattern summaries shown as editable preferences, never as compatibility scores. | Better user control and recommendation accuracy. | Medium | 21 |
| Concierge-Lite Planning | P2 | Monetisation and retention | Human-assisted planning for high-intent premium plans, venue changes, and special group occasions. | Higher paid conversion and plan completion for premium users. | High | 22 |
| Founder Host Network | P2 | PLG and city operations | Verified recurring hosts create venue-led social pods and share group-safe invitations. | More repeatable local supply and lower operations load. | High | 23 |
| Post-Safety Recovery Path | P2 | Retention and trust | Guided path after a report, canceled plan, or safety exit to preserve user trust and restart safely if appropriate. | Lower churn after negative events, better safety satisfaction. | Medium | 24 |

## Prioritization Logic

The P0 sequence targets the current highest-risk funnel: account creation to verified group, verified group to first Introduction, match to Plan, Plan to attended meetup, and attended meetup to usable private feedback. These are prerequisites for The Nine to improve growth and retention without shifting the product back into solo dating or session optimization.

P1 adds city-rhythm and PLG loops after the first-value path is reliable. These features create more reasons to open The Nine, but each reason is tied to a real group, Introduction, Plan, RSVP, debrief, venue, or safety state change. P1 also adds internal ranking improvements and monetization surfaces that accelerate execution without reducing free baseline distribution.

P2 features are high-potential but depend on more data, operational capacity, privacy review, or proven willingness to pay. They should not block alpha or seeded-city beta, and none should be used as a workaround for incomplete group liquidity.

## Non-Negotiable Guardrails For All Features

1. The Group remains the atomic unit for dating inventory, conversations, Plans, entitlement effects, and safety context.
2. No feature introduces individual discovery, solo swiping, solo feeds, or member-owned dating conversations.
3. Compatibility and reliability scores are internal ranking inputs only. They are never displayed as numbers, badges, tiers, or attractiveness labels.
4. Paid features add coordination, venue access, templates, host tools, or explicit extra stack size. They never throttle free matching or reduce free baseline distribution.
5. Notifications must originate from persisted state changes. There are no generic comeback pings or synthetic scarcity prompts.
6. Debrief interest remains private unless mutual. Post-meetup preference learning requires explicit consent before use in ranking.
7. Every active group, chat, Plan, pod, debrief, calendar, and post-meetup surface exposes a safety action within one tap.
8. The public domain for share and invite surfaces is `thenine.com`.

---
<!-- doc-version: 1.0 -->
