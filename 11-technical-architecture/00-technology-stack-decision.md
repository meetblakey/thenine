# Technology Stack Decision

## Architecture Position

[APPNAME] is a group-first, verification-gated mobile product. The stack is optimized for fast mobile iteration, strong relational integrity, reliable realtime chat, explicit consent boundaries, privacy-preserving post-meetup data, and state-change-only notifications.

The group is the unit of distribution, conversation ownership, planning, entitlement effects, and safety consensus. Members authenticate and act, but no Member receives introductions or owns a dating conversation outside a complete verified Group.

## Decisions

| Layer | Decision | Requirement Basis | Rejected Alternatives |
|---|---|---|---|
| Mobile client | React Native with Expo, Expo Router, EAS Build, TypeScript | [APPNAME] needs iOS and Android delivery, native SDK bridges for verification, push, and IAP, and rapid iteration during city-by-city launch. TypeScript keeps app and API contracts aligned. | Native Swift plus Kotlin: best native control but doubles product surface cost. Flutter: credible, but weaker alignment with the TypeScript backend and less direct reuse of shared domain contracts. |
| API framework | NestJS with Fastify, TypeScript, OpenAPI generation | The domain has strict modules: groups, introductions, chat, plans, debriefs, safety, verification, entitlements. NestJS gives explicit module boundaries, guards, interceptors, and testable services while staying TypeScript-only. | Ruby on Rails: fast CRUD but weaker shared typing with mobile/API contracts. Go services: strong runtime profile but slower product iteration and more duplicated schema typing. |
| Real-time transport | Ably Realtime Channels with API-issued scoped tokens and Postgres as source of truth | Group chat, breakout threads, plan RSVP, safety state, and debrief prompts need reliable fanout without making a chat vendor the system of record. Ably handles realtime delivery; [APPNAME] owns authorization, persistence, moderation, and replay. | Stream Chat: faster chat bootstrap but makes group ownership, safety consensus, and private debrief boundaries harder to enforce consistently. Firebase Realtime Database or Firestore: good client sync, but weaker transactional fit for multi-object group state and relational audit requirements. |
| Database | AWS Aurora PostgreSQL 16 with PostGIS, row-level encryption where needed, Drizzle migrations | The product is stateful and relational: complete verified groups, mutual group interest, RSVP quorums, private mutual debrief edges, consensus blocks, and entitlement inheritance all need transactions and constraints. PostGIS supports city, neighborhood, and venue matching. | MongoDB: flexible, but weak for consent and eligibility constraints spanning many objects. DynamoDB primary store: high scale, but complex for relational joins and evolving safety review workflows. |
| Cache | AWS ElastiCache for Redis | Matching allocation locks, rate limits, realtime presence leases, idempotency markers, and short-lived eligibility snapshots need low-latency ephemeral state. | In-process cache: unsafe across horizontally scaled API workers. Database-only caching: durable but too slow for rate limits and presence. |
| Queue and scheduling | AWS SQS Standard and FIFO queues plus EventBridge Scheduler, consumed by NestJS workers | Verification callbacks, moderation jobs, push intents, plan deadlines, RSVP reminders, debrief prompts, and matching runs must be asynchronous, idempotent, and retryable. FIFO queues are used where per-aggregate order matters. | Kafka: powerful but operationally heavy before scale justifies it. Redis-only BullMQ: fast, but makes durable workflow recovery and cloud IAM boundaries weaker. |
| Media storage and processing | Amazon S3 private buckets, presigned upload URLs, ECS/Lambda processors using Sharp, KMS encryption | Profile photos, vouch media, chat attachments, venue images, and report evidence must be private by default, moderation-gated, and auditable. Raw identity documents stay with the verification vendor. | Public object storage paths: violates profile and evidence privacy. Cloudinary as source of truth: useful transformations but less control over safety evidence retention and deletion policy. |
| CDN | Amazon CloudFront with signed URLs and origin access control | Approved profile and venue media need low-latency delivery while preserving privacy and revocation. Signed URLs prevent public scraping of group/member media. | Fastly: excellent CDN, but less integrated with the selected AWS media stack. Direct S3 delivery: simpler but weaker performance and access control posture. |
| Identity verification | Persona government-ID plus liveness SDK, integrated through server-created inquiries and provider-signed webhooks | Verification is a hard distribution gate. Persona supports ID document checks, liveness, reusable workflows, review states, and region-aware verification policies while keeping raw document handling out of [APPNAME]. | Stripe Identity: strong option but less flexible for multi-step trust workflows and reviewer operations. Onfido: credible enterprise vendor, but Persona is a better startup fit for workflow configuration and developer speed. |
| Content moderation | Hive Moderation API for text/image/video classification plus an internal human review console | Group names, vouch blurbs, profile photos, messages, attachments, venue comments, and safety evidence need consistent moderation. Automated classification holds or routes content; humans decide ambiguous high-impact cases. | Perspective API only: text-focused and insufficient for photos/evidence. Fully homegrown ML: unjustified risk and maintenance cost at Series A stage. |
| Push notifications | OneSignal transactional push behind an internal Notification Service | Push must fire only on meaningful state changes. OneSignal handles APNs/FCM delivery, devices, localization, and receipts while [APPNAME] enforces state-change eligibility, quiet hours, category preferences, and no re-engagement pings. | Expo push only: good for prototypes, weaker for production delivery controls and diagnostics. Braze: powerful lifecycle tooling, but too marketing-oriented for the state-change-only constraint. |
| Payments and IAP | RevenueCat for App Store and Google Play subscriptions/entitlements; Stripe PaymentIntents for real-world event and venue payments where platform policy allows | Subscription and IAP entitlements must be consistent across platforms. Paid tiers can add coordination tools, premium plans, and expanded stack size, but never throttle free distribution. Real-world plan payments need clear refund and cancellation handling. | Direct StoreKit and Play Billing: more control, but duplicates entitlement state and receipt validation. Stripe-only: cannot cover native digital subscriptions inside mobile app store policy. |
| Analytics | PostHog Cloud with strict event taxonomy, feature flags, privacy controls, and warehouse export | The metrics model is group-centered: activation, matching, planning, attendance, debrief, safety, and monetization must be measured by Group, Plan, and Debrief, not only by individual sessions. | GA4: weaker domain modeling and governance for group object funnels. Segment plus Amplitude: strong but more expensive and operationally fragmented for early-stage product analytics. |
| Monitoring | Sentry for mobile/API errors and Datadog for logs, metrics, traces, SLOs, and alerting | Safety, matching, push, verification, payments, and realtime delivery need production observability with traceable state transitions and on-call alerts. | CloudWatch-only: acceptable substrate but too thin for product-level incident triage. Logs-only monitoring: cannot support SLOs or cross-service tracing. |
| CI/CD | GitHub Actions with OIDC to AWS, Terraform, Drizzle migrations, EAS Build/Submit, and protected production approvals | The product needs reproducible API, worker, infrastructure, and mobile releases with migration safety, automated tests, and environment-specific secrets. | Manual deploys: unacceptable for safety and payments. Jenkins: powerful but unnecessary operational overhead. |
| Hosting | AWS ECS Fargate for API and workers; Aurora, ElastiCache, SQS, EventBridge, S3, CloudFront, KMS, Secrets Manager | [APPNAME] needs long-running API processes, workers, private networking, VPC controls, and managed durability without Kubernetes overhead. | Vercel-only serverless: excellent frontend hosting but less suitable for websocket-adjacent workers, long-running jobs, and private network service composition. EKS/Kubernetes: too much platform surface before the team needs custom orchestration. |

## Cross-Layer Defaults

| Concern | Default |
|---|---|
| Language | TypeScript across mobile, API, workers, shared contracts, scripts, and tests. |
| API contract | OpenAPI 3.1 generated from NestJS decorators plus hand-reviewed narrative docs. |
| Data access | Drizzle migrations and typed repositories; raw SQL allowed for matching and reporting queries. |
| IDs | UUIDv7 for primary keys to preserve uniqueness and index locality. |
| Time | UTC in storage; member-facing display uses member locale and plan city timezone. |
| Geography | Coarse neighborhood and PostGIS geography points for venues; no precise member location persisted unless explicitly required for attendance plausibility. |
| Eventing | Domain event outbox table persisted in the same transaction as state changes, then delivered to queues, realtime, analytics, and push. |
| Privacy | Verification artifacts stay with Persona; [APPNAME] stores verification status, inquiry IDs, audit metadata, and risk flags only. |
| Entitlements | Entitlements add capabilities. They never alter baseline safety, verification, reporting, blocking, group eligibility, or free distribution guarantees. |

## Required Technical Invariants

1. A `Member` can authenticate, verify, and act, but only a complete verified `Group` can receive an introduction.
2. A `Group` is complete only when its format-specific membership rules, verification rules, profile fields, and publish approvals are satisfied.
3. Quartet groups require exactly two active verified members.
4. Social-pod participation is still represented by a complete verified `Group`; solo pod participants are modeled as one-member social-pod groups, not loose member inventory.
5. Conversations are group-owned. Breakout conversations are consent-gated child threads, not free-standing member DMs.
6. Post-meetup interest is private by default. The system only reveals mutual edges to the two involved Members.
7. Push notifications are derived from persisted state changes only. No service may create a generic re-engagement notification.
8. Paid state may expand tools or stack size but may not suppress free group distribution.
9. Safety actions must be available from active group and chat surfaces with one-tap entry and a low-latency API path.
10. Reports, blocks, leaves, urgent actions, and emergency guidance must not depend on subscription state.

## Open Questions

| Question | Recommended Default | Technical Basis |
|---|---|---|
| Should Temporal be introduced before public beta? | No. Use SQS, FIFO queues, EventBridge Scheduler, and idempotent workers until workflows show enough branching complexity to justify Temporal. | Current workflows are deadline-driven and can be modeled as state machines plus scheduled jobs. Avoiding Temporal reduces operational load while preserving upgrade path. |
| Should profile media transformations use Lambda or ECS workers first? | ECS workers first, Lambda only for small bounded transformations. | Dating media can include large originals and moderation handoffs. ECS gives better memory, timeout, and observability control. |
| Should [APPNAME] deploy multi-region before second city? | No. Start single-region multi-AZ with backup and disaster recovery drills; add read replicas or regional edge only after measured latency requires it. | The first launch is city-dense. Multi-region adds data residency and consistency complexity before user density requires it. |

---
<!-- doc-version: 1.0 -->
