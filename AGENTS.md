# AGENTS.md

## Mission

You are implementing [APPNAME], a group-only dating app. Read this file first, then read the relevant architecture document before changing code. The product source of truth is the documentation in `00-strategy` through `10-appendices`; the technical source of truth is `11-technical-architecture`.

Do not reinterpret the product into solo dating. The Group is the unit that receives introductions, owns conversations, confirms meetups, receives additive entitlement effects, and participates in safety consensus.

## Required Reading Order

1. `11-technical-architecture/00-technology-stack-decision.md`
2. `11-technical-architecture/01-system-architecture-overview.md`
3. The architecture doc for the feature you are touching.
4. The matching product spec in `03-feature-specs` when implementing user behavior.
5. The safety and compliance docs when touching verification, chat, plans, debriefs, reports, notifications, or payments.

## Architecture Files

```text
11-technical-architecture/
├── 00-technology-stack-decision.md
├── 01-system-architecture-overview.md
├── 02-data-models.md
├── 03-api-spec.md
├── 04-real-time-architecture.md
├── 05-matching-engine-design.md
├── 06-media-pipeline.md
├── 07-verification-integration.md
├── 08-moderation-pipeline.md
├── 09-push-notification-service.md
├── 10-subscription-entitlement-service.md
├── 11-security-model.md
├── 12-infrastructure-and-environments.md
└── 13-ci-cd-pipeline.md
```

## Non-Negotiable Invariants

1. Members authenticate and act; Groups receive dating inventory.
2. No Member appears in discovery without a complete verified Group.
3. Quartet Groups have exactly two active verified members.
4. Social-pod participation is represented as a complete verified Group, even when the Group has one member.
5. Introductions are bounded and group-owned.
6. Paid tiers may add tools or explicit extra stack size; they must not reduce free baseline distribution.
7. Conversations are group-owned. Breakouts are consent-gated child threads.
8. Post-meetup interest remains private unless mutual.
9. Reports, blocks, leaves, emergency guidance, and share-plan actions are available from every active group or chat surface.
10. Push notifications are created only from persisted state changes.

## Expected Implementation Shape

Use TypeScript across mobile, API, workers, shared contracts, scripts, and tests.

Prefer these boundaries:

- `apps/mobile` for React Native and Expo.
- `apps/api` for NestJS API.
- `apps/workers` for queue consumers and scheduled jobs.
- `packages/domain` for shared domain types and invariant helpers.
- `packages/api-contracts` for generated and hand-authored API types.
- `packages/db` for Drizzle schema and migrations.
- `packages/testing` for shared fixtures.
- `infra` for Terraform.
- `docs` only if a future repo layout moves the existing architecture docs.

## Feature Implementation Checklist

Before coding:

1. Identify the owning domain module.
2. Confirm whether the feature is member-scoped, group-scoped, conversation-scoped, plan-scoped, or staff-scoped.
3. Confirm group eligibility and verification requirements.
4. Confirm safety, privacy, and notification implications.
5. Confirm whether docs need updates.

While coding:

1. Put invariants in domain services, not only controllers.
2. Persist state before emitting realtime, push, analytics, or provider side effects.
3. Use idempotency keys on mutating API routes and webhook processors.
4. Add tests for forbidden member-level discovery paths.
5. Add tests for one-sided debrief privacy when touching debriefs.
6. Add tests proving paid state does not lower free baseline distribution when touching matching or entitlements.
7. Add tests proving notification intents require a source domain event when touching push.

Before finishing:

1. Run typecheck, lint, unit tests, and relevant integration tests.
2. Verify architecture docs still match the implemented API, schema, events, and provider behavior.
3. State clearly what was verified and what was not.

## Coding Rules

- Use explicit domain names: `groupId`, `recipientGroupId`, `sourceGroupId`, `targetGroupId`, `planId`, `conversationId`.
- Do not name dating inventory APIs around members, swipes, likes, feeds, or boosts.
- Use `Introduction`, not swipe or feed.
- Use `Express interest`, not like.
- Use `Plan`, not booking unless integrating with venue reservation infrastructure.
- Use `Breakout`, not unlocked DM.
- Keep provider adapters behind interfaces.
- Keep raw provider webhooks out of domain services.
- Keep safety actions independent of subscriptions.
- Keep debrief interest out of analytics payloads unless aggregated and privacy-reviewed.

## Documentation Update Triggers

Update `11-technical-architecture` in the same change when you alter:

- Technology stack or provider.
- Database table, field, index, enum, or relationship.
- API method, path, auth rule, request, response, or error code.
- Realtime channel, event, payload, or delivery guarantee.
- Matching hard filter, scoring feature, allocation rule, or cold-start behavior.
- Verification, moderation, media, push, payment, or entitlement integration.
- Security authorization rule or staff access behavior.
- Infrastructure topology, environment, queue, or deployment process.

## Prohibited Shortcuts

- Do not create solo discovery endpoints.
- Do not create member-owned dating conversations.
- Do not expose one-sided debrief interest.
- Do not add re-engagement pushes.
- Do not use paid state as a ranking or visibility throttle.
- Do not store raw government ID or liveness media.
- Do not hide safety actions behind menus that require more than one tap from active group or chat surfaces.
- Do not introduce unfinished production paths.

---
<!-- doc-version: 1.0 -->
