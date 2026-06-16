# Design And UX QA Lock

## Purpose

The highest-risk UX in The Nine is not decoration. It is whether users understand verification blockers, invite consent, Group visibility, Introduction reasons, Plan confirmation, debrief privacy, safety exits, no-inventory states, and paid disclosures. These states must be locked before mobile build acceptance.

## Authoritative Sources Reviewed

| Source | Relevance |
|---|---|
| `02-experience/screen-inventory.md` | Current screens and state expectations. |
| `02-experience/*-flow.md` | Existing onboarding, group creation, matching, chat-to-meetup, and post-meetup flows. |
| `04-content/content-strategy.md` | Voice, messaging pillars, content principles. |
| `04-content/ux-copy-guide.md` | Required copy patterns and terminology. |
| `05-safety/safety-model.md` | Safety surface requirements. |
| `12-product-growth-expansion/01-p0-feature-specs.md` | P0 expansion screen states. |
| `12-product-growth-expansion/02-p1-feature-specs.md` | P1 expansion screen states. |
| `12-product-growth-expansion/05-p2-feature-specs.md` | P2 expansion screen states. |

## Required UX Locks

| UX area | Lock requirement |
|---|---|
| Verification blockers | Clear reason, next action, no distribution until approval. |
| Invite consent | Invitee preview, privacy explanation, accept/decline, no public exposure. |
| Group visibility | Exact preview before publication; all active members approve. |
| No inventory | Honest reason and supply actions; no fake scarcity or paid workaround. |
| Introduction reasons | Plain allowed categories; no scores, ranks, or desirability claims. |
| Plan confirmation | RSVP rule, venue, time, safety share, cancellation/reconfirmation states. |
| Debrief privacy | Interest private unless mutual; learning consent separate from safety. |
| Safety actions | One-tap report/block/leave/urgent/share as appropriate. |
| Paid disclosures | Price, included/excluded, renewal, cancellation, refund, venue costs. |
| Staff/host context | Host and concierge roles clear without exposing private data. |

## QA Evidence

| Artifact | Requirement |
|---|---|
| Screen state checklist | Every touched screen has empty, loading, error, populated, disabled, expired, safety, and permission states where relevant. |
| Copy review | Uses Group, Introduction, Express interest, Plan, Breakout, Vouch; avoids swipe, like, boost, unlock DM. |
| Safety surface audit | One-tap safety entry on active Group, chat, Plan, pod, venue, debrief, Moment, host, and recovery screens. |
| Privacy comprehension | User can tell who sees invite, profile, debrief interest, Moment, cohort, and calendar data. |
| Accessibility pass | Critical actions reachable, readable, and not hidden in gestures or low-contrast controls. |
| Mobile QA | iOS and Android state coverage for P0 vertical slice. |

## Acceptance Evidence

This lock is complete when:

1. P0 vertical slice screens are mapped to all required states.
2. UX copy has product and safety approval.
3. Safety action placement is audited for every active surface.
4. No paid or no-inventory copy implies visibility throttling.
5. Debrief and consent copy passes privacy review.
6. Mobile acceptance criteria include screenshots or recorded QA for critical states.

## Engineering Blockers

- No UI state for verification pending, retry, rejected, or appeal.
- Invite preview does not explain visibility and consent.
- Safety action hidden behind more than one tap on active surfaces.
- Plan confirmation does not show RSVP rule and safety sharing.
- Debrief learning consent is bundled into required debrief submission.
- Paid templates lack full consumer disclosures.

---
<!-- doc-version: 1.0 -->
