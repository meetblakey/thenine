# Safety Model

## Safety Thesis

[APPNAME] should treat safety as product infrastructure. Group context lowers perceived pressure, but it does not eliminate risk. The product must verify participants, structure accountability, expose safety actions, and use post-meetup feedback to improve the system.

## Safety Layers

| Layer | Purpose | Launch Requirement |
|---|---|---|
| Identity verification | Ensure every distributed participant is real and eligible. | Required before matching. |
| Group eligibility | Prevent incomplete or unverified groups from entering discovery. | Required for all introductions. |
| Profile moderation | Reduce fraud, harassment, sexual coercion, and unsafe claims. | Required before distribution where flagged. |
| Chat safeguards | Detect harmful messages and expose reporting/leave controls. | Required in group and breakout chats. |
| Plan safety | Make venue, time, RSVP, and plan sharing clear. | Required for confirmed meetups. |
| Event roles | Assign host or coordinator responsibility for pods. | Required for social pods. |
| Post-meetup debrief | Capture attendance, quality, interest, and incident feedback. | Required prompt after every plan. |
| Enforcement | Apply warnings, feature restrictions, suspensions, bans, and venue suppression. | Required from private alpha. |

## Safety Surface Requirements

- Report must be accessible from profile, group card, group chat, breakout, plan, pod, venue, and debrief.
- Leave group must be accessible from active group and active chat.
- Block must prevent future contact where policy permits.
- Share plan must be accessible from confirmed plan and safety center.
- Urgent help must clearly state that [APPNAME] is not emergency services.
- Users should not need to complete romantic interest capture to file a report.

## Risk Categories

| Category | Examples | Default Handling |
|---|---|---|
| Identity risk | Fake identity, impersonation, underage, duplicate fraud | Pause distribution and route to trust review. |
| Harassment | Insults, repeated unwanted contact, targeted abuse | Remove content, warn, restrict, or suspend. |
| Sexual misconduct | Explicit coercion, non-consensual sexual content, threats | Immediate protective action and priority review. |
| Discrimination | Protected-class abuse or exclusionary harassment | Content action and enforcement based on severity. |
| Scam and financial harm | Payment requests, investment scams, off-platform fraud | Remove, restrict, and investigate network risk. |
| Physical safety | Threats, stalking, unsafe venue behavior | Priority review, protective restrictions, support guidance. |
| Venue risk | Unsafe location, bad partner conduct, repeated no-shows | Suppress or review venue and partner status. |
| Group manipulation | Coercive friend dynamics, repeated bad-faith group formation | Group restriction and trust review. |

## Group-Specific Controls

- If one member is suspended, all groups containing that member become ineligible.
- If one member leaves, active introductions stop and active plans reconfirm.
- If a report targets a group, the reporter can hide from all reported group members.
- Pod hosts must accept role expectations before event confirmation.
- Larger pods should use private post-event interest capture to reduce public pressure.

## Safety Metrics

- Safety reports per 1,000 introductions.
- Safety reports per 1,000 confirmed meetups.
- Severity-one incident rate.
- Median first response time by severity.
- Repeat offender detection rate.
- Report outcome satisfaction.
- Plan-share adoption rate.
- Venue suppression rate.

---
<!-- doc-version: 1.0 -->
