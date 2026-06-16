# [APPNAME] Product Requirements Document

## Product Vision

[APPNAME] makes dating social by default. Verified groups discover, coordinate, meet, and debrief through a product designed around the real-world group meetup, not the individual swipe.

## Problem Statement

Current dating apps over-optimize for individual discovery, attention, and paid visibility. Users increasingly report burnout, safety anxiety, intent mismatch, low reply quality, and reluctance to meet strangers one-on-one. Group dating formats lower pressure, create social proof, and add built-in referral loops, but existing products treat them as features or events rather than the core product architecture.

## Success Metrics

- North-star metric: verified real-world group meetups per weekly activated group.
- Activation: percentage of new verified users who join or create a complete group within 24 hours.
- Liquidity: median time from complete group to first qualified group introduction.
- Conversion: percentage of qualified group introductions that become confirmed meetups within 14 days.
- Quality: post-meetup satisfaction and mutual-interest edges per meetup.
- Safety: safety reports per 1,000 confirmed meetups, severity-adjusted incident rate, and median response time.
- Trust: verification completion rate, invite acceptance rate, and cancellation/cancellation-reason distribution.
- Monetization: revenue per activated group without degradation in meetup conversion or safety guardrails.

## User Segments

- **Friend-led daters:** singles who want a romantic context but prefer entering with a trusted friend.
- **Burned-out app returners:** former app users who need a format that feels materially different from solo feeds.
- **Safety-sensitive planners:** users who need verification, shared plans, and clear exits before meeting.
- **Social-pod explorers:** users open to meeting six to eight people first, then privately indicating friend or crush interest.
- **Group organizers:** socially active users who can form groups, host plans, and seed local density.

## Core Use Cases

- Create a verified two-person group with a friend and meet another compatible group.
- Join a six-to-eight-person social pod based on time, neighborhood, vibe, and intent.
- Use friend-authored vouch blurbs to add trust and context to a group profile.
- Coordinate venue, time, RSVPs, and safety contacts inside a matched group.
- Meet in person and privately express post-meetup interest as friend, crush, both, or no interest.
- Report, block, leave, or escalate safety issues before, during, or after a group interaction.

## Prioritized Feature List

| Priority | Feature | Rationale |
|---|---|---|
| P0 | Identity verification gate | Required before distribution; research shows trust and safety are acquisition and conversion drivers. |
| P0 | Group object model | The group is the atomic unit; no discovery exists without a complete group. |
| P0 | Group profile with individual sub-cards | Makes the unit legible while preserving individual identity. |
| P0 | Friend invite and group formation | Built-in referral loop and required activation step. |
| P0 | Quartet matching | Validated by Tinder Double Date, Doubble, Tandem, and PlotTwist. |
| P0 | Group chat with safety overlays | Default communication model that preserves group context and reduces solo pressure. |
| P0 | Meetup planner | Real-world group meetup is the north star; coordination must be first-class. |
| P0 | Post-meetup feedback and interest capture | Converts social context into romantic and platonic edges without public pressure. |
| P0 | Reporting, blocking, leave group, share plan | Safety must be available at every risky moment. |
| P1 | Social pods | Six-to-eight-person format validated by Bumble Plans but operationally heavier than quartets. |
| P1 | Venue partner inventory | Enables better logistics and monetization after early demand is proven. |
| P1 | Guided icebreakers and scheduling prompts | Supports conversation and planning without replacing user agency. |
| P1 | Premium coordination tools | Monetizes execution after first value. |
| P1 | Host roles and group responsibilities | Reduces diffusion of responsibility in larger groups. |
| P2 | Advanced compatibility insights | Useful after data depth improves; not necessary for launch trust. |
| P2 | Concierge-lite event support | Valuable but operationally expensive. |
| P2 | Alumni groups and friend-network expansion | Growth feature after base group meetup loop is healthy. |

## Constraints

- Group is the atomic unit.
- No individual discovery or solo swiping.
- Identity verification is required before any matching distribution.
- No visibility throttling, artificial deprivation, or manipulative monetization.
- Safety tools are first-class.
- North-star metric is verified real-world group meetups.
- [APPNAME] remains a placeholder product name throughout these docs.

## Assumptions

- Launch starts in one dense city with concentrated nightlife, social venues, and friend networks.
- The first production product supports quartets and a controlled social-pod pilot.
- Users will accept verification friction if it visibly improves trust and access.
- Group invites can outperform paid acquisition in seeded communities when activation is clear.
- Venue supply can be manually curated before any marketplace-scale operating model is needed.

## Out of Scope

- Solo swipe feeds.
- Individual profile discovery independent of a group.
- Hidden desirability scores shown to users.
- Boost products that reduce baseline distribution for non-paying groups.
- Long-form matchmaking services that require human matchmakers for every introduction.
- General friendship networking without dating or social-romantic intent.
- Technology stack, vendor selection, or implementation architecture.

---
<!-- doc-version: 1.0 -->
