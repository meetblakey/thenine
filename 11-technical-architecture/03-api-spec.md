# API Spec

## OpenAPI 3.1 Narrative

The public API is versioned under `/v1`. The contract is described as a human-readable OpenAPI 3.1 narrative: each endpoint has method, path, auth, request shape, response shape, and error codes. Generated OpenAPI schemas must match these docs before release.

Authentication uses a member session JWT. Group-scoped endpoints also require active membership or explicit plan/conversation access. Provider webhooks use provider signatures and idempotency keys.

## Common Types

```typescript
export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "IDEMPOTENCY_CONFLICT"
  | "PROVIDER_SIGNATURE_INVALID"
  | "VERIFICATION_REQUIRED"
  | "GROUP_ACCESS_DENIED"
  | "GROUP_NOT_COMPLETE"
  | "GROUP_INELIGIBLE"
  | "INTRODUCTION_EXPIRED"
  | "INTRODUCTION_UNAVAILABLE"
  | "INTERNAL_APPROVAL_REQUIRED"
  | "CONVERSATION_CLOSED"
  | "MESSAGE_MODERATION_HELD"
  | "BREAKOUT_INELIGIBLE"
  | "CONSENT_REQUIRED"
  | "PLAN_NOT_CONFIRMABLE"
  | "RSVP_CLOSED"
  | "DEBRIEF_NOT_AVAILABLE"
  | "MUTUAL_EDGE_NOT_FOUND"
  | "ENTITLEMENT_REQUIRED"
  | "MEDIA_NOT_APPROVED"
  | "PAYMENT_PROVIDER_ERROR"
  | "UNPROCESSABLE_STATE";

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    fieldErrors?: Array<{ field: string; message: string }>;
    retryAfterSeconds?: number;
  };
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
```

## Resource Shapes

```typescript
export type LaunchpadBlocker =
  | "verification_required"
  | "create_or_join_group"
  | "invite_pending"
  | "profile_required"
  | "availability_required"
  | "publish_approval_required"
  | "moderation_required"
  | "safety_paused"
  | "eligible_for_first_introduction"
  | "thin_city_no_inventory";

export type LaunchpadActionKind =
  | "start_verification"
  | "create_group"
  | "invite_friend"
  | "complete_profile"
  | "add_availability"
  | "approve_visibility"
  | "resolve_safety_blocker"
  | "open_first_introduction"
  | "edit_neighborhoods"
  | "join_pod_waitlist";

export interface LaunchpadResource {
  memberId: string;
  activeGroupId: string | null;
  readinessStatus:
    | "verification_blocked"
    | "needs_group"
    | "needs_group_member"
    | "needs_profile"
    | "needs_availability"
    | "needs_publish_approval"
    | "blocked_by_moderation"
    | "blocked_by_safety"
    | "eligible"
    | "thin_city_waiting";
  blockers: LaunchpadBlocker[];
  primaryAction: { kind: LaunchpadActionKind; label: string; href: string; groupId: string | null };
  secondaryActions: Array<{ kind: LaunchpadActionKind; label: string; href: string; groupId: string | null }>;
  safetyActions: Array<{ kind: "report" | "block" | "leave" | "urgent_help" | "share_plan"; surface: "launchpad"; groupId: string | null }>;
  refreshesAt: string | null;
}

export interface MemberResource {
  id: string;
  firstName: string;
  cityId: string;
  verificationStatus: VerificationStatus;
  status: MemberStatus;
  notificationSummary: { enabledCategories: NotificationCategory[] };
}

export interface GroupResource {
  id: string;
  cityId: string;
  format: GroupFormat;
  status: GroupStatus;
  name: string | null;
  intent: string | null;
  neighborhoodIds: string[];
  availabilityWindows: Array<{ startsAt: string; endsAt: string; timezone: string }>;
  eligibilityStatus: string;
  eligibilityBlockers: string[];
  members: Array<{ memberId: string; firstName: string; role: string; verificationStatus: VerificationStatus; membershipStatus: string }>;
}

export interface GroupInviteResource {
  id: string;
  groupId: string;
  inviterMemberId: string;
  tokenHash: string;
  recipientHintHash: string | null;
  status: "pending" | "accepted" | "declined" | "expired" | "revoked" | "approval_required";
  expiresAt: string;
  acceptedByMemberId: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface InviteRelayEventResource {
  id: string;
  inviteId: string;
  groupId: string;
  eventType: "created" | "opened" | "declined" | "accepted" | "approval_required" | "approved" | "rejected";
  sourceChannel: "share_link" | "qr_code" | "manual_share";
  occurredAt: string;
}

export interface GroupAvailabilityMeshResource {
  groupId: string;
  complete: boolean;
  missingMemberIds: string[];
  overlapWindows: Array<{
    startsAt: string;
    endsAt: string;
    timezone: string;
    source: "member_entered";
    confirmedByMemberIds: string[];
  }>;
  computedAt: string;
}

export interface IntroductionResource {
  id: string;
  recipientGroupId: string;
  kind: IntroductionKind;
  targetGroup?: GroupCardResource;
  targetPlan?: PlanSummaryResource;
  status: IntroductionStatus;
  rankPosition: number;
  reasonCodes: string[];
  expiresAt: string;
}

export interface GroupCardResource {
  groupId: string;
  format: GroupFormat;
  name: string;
  sharedVibe: string;
  intent: string;
  neighborhoods: string[];
  memberCards: Array<{ memberId: string; firstName: string; ageBand: string | null; pronouns: string | null; prompts: Record<string, string> }>;
  vouches: Array<{ subjectMemberId: string; authorMemberId: string; body: string }>;
  recommendationReasons: string[];
}

export interface ConversationResource {
  id: string;
  kind: ConversationKind;
  status: ConversationStatus;
  groupIds: string[];
  parentConversationId: string | null;
  lastMessageAt: string | null;
  participantMemberIds: string[];
}

export interface MessageResource {
  id: string;
  conversationId: string;
  senderMemberId: string;
  senderGroupId: string;
  body: string | null;
  mediaAssetIds: string[];
  moderationStatus: ModerationStatus;
  sequenceNumber: number;
  createdAt: string;
}

export interface PlanSummaryResource {
  id: string;
  format: PlanFormat;
  status: PlanStatus;
  startsAt: string | null;
  venueName: string | null;
  groupIds: string[];
}

export interface PlanResource extends PlanSummaryResource {
  conversationId: string | null;
  venueId: string | null;
  manualVenueName: string | null;
  manualVenueAddress: string | null;
  endsAt: string | null;
  rsvpDeadlineAt: string | null;
  options: Array<{ id: string; optionType: string; label: string; startsAt: string | null; venueId: string | null }>;
  rsvps: Array<{ memberId: string; groupId: string; status: string; respondedAt: string | null }>;
}

export interface PlanFastTrackProposalResource {
  id: string;
  conversationId: string;
  createdByMemberId: string;
  sourceGroupId: string;
  groupIds: string[];
  format: PlanFormat;
  proposalState: "proposed" | "manual_required" | "accepted" | "expired";
  confidence: "recommended" | "manual";
  timeOptions: Array<{ id: string; startsAt: string; endsAt: string; timezone: string }>;
  venueOptions: Array<{ id: string; venueId: string; label: string; venueType: string; safetyStatus: "approved" }>;
  safetyContext: { sharePlanAvailable: boolean; safetyActions: string[] };
  createdAt: string;
}

export interface DebriefResource {
  id: string;
  planId: string;
  memberId: string;
  attendanceStatus: string;
  qualityRating: number | null;
  safetyConcern: boolean;
  submittedAt: string | null;
}

export interface DebriefLearningConsentResource {
  id: string;
  debriefId: string;
  planId: string;
  memberId: string;
  groupId: string;
  status: "granted" | "declined" | "revoked";
  grantedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
}

export interface ActionQueueItemResource {
  id: string;
  memberId: string;
  groupId: string | null;
  sourceEventId: string;
  sourceEventName: string;
  targetType: "verification" | "group" | "introduction" | "conversation" | "plan" | "debrief" | "safety";
  targetId: string;
  actionKind: string;
  priority: "safety" | "deadline" | "standard";
  deadlineAt: string | null;
  status: "pending" | "completed" | "dismissed" | "expired";
  dismissible: boolean;
  createdAt: string;
}

export interface SafetyCaseResource {
  id: string;
  severity: SafetySeverity;
  status: string;
  protectiveActionAppliedAt: string | null;
  createdAt: string;
}

export interface LaunchpadResource {
  memberId: string;
  activeGroupId: string | null;
  readinessStatus:
    | "verification_blocked"
    | "needs_group"
    | "needs_group_member"
    | "needs_profile"
    | "needs_availability"
    | "needs_publish_approval"
    | "blocked_by_moderation"
    | "blocked_by_safety"
    | "eligible"
    | "thin_city_waiting";
  blockers: string[];
  primaryAction: { kind: string; label: string; href: string; groupId: string | null };
  secondaryActions: Array<{ kind: string; label: string; href: string; groupId: string | null }>;
  safetyActions: Array<{ kind: "report" | "block" | "leave" | "urgent_help" | "share_plan"; surface: "launchpad"; groupId: string | null }>;
  refreshesAt: string | null;
}
```

## Auth and Session

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `GET` | `/v1/session` | Member JWT | None | `{ member: MemberResource; activeGroup: GroupResource | null; entitlements: EntitlementResource[] }` | `UNAUTHENTICATED`, `FORBIDDEN` |
| `GET` | `/v1/launchpad` | Member JWT | None | `LaunchpadResource` | `UNAUTHENTICATED`, `FORBIDDEN` |
| `POST` | `/v1/auth/logout` | Member JWT | None | `{ ok: true }` | `UNAUTHENTICATED`, `RATE_LIMITED` |
| `GET` | `/v1/realtime/token` | Member JWT | `{ groupId?: string; conversationId?: string; planId?: string }` as query | `{ token: string; expiresAt: string; capabilities: Record<string, string[]> }` | `UNAUTHENTICATED`, `FORBIDDEN`, `GROUP_ACCESS_DENIED`, `NOT_FOUND`, `RATE_LIMITED` |

## Members and Verification

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `GET` | `/v1/members/me` | Member JWT | None | `MemberResource` | `UNAUTHENTICATED`, `NOT_FOUND` |
| `PATCH` | `/v1/members/me` | Member JWT | `{ firstName?: string; pronouns?: string | null; cityId?: string }` | `MemberResource` | `UNAUTHENTICATED`, `VALIDATION_ERROR`, `CONFLICT`, `FORBIDDEN` |
| `POST` | `/v1/verification/sessions` | Member JWT | `{ returnUrl: string; platform: "ios" | "android" }` | `{ provider: "persona"; inquiryId: string; clientSecret: string; expiresAt: string }` | `UNAUTHENTICATED`, `RATE_LIMITED`, `CONFLICT`, `UNPROCESSABLE_STATE` |
| `GET` | `/v1/verification/status` | Member JWT | None | `{ status: VerificationStatus; failureReasonCode: string | null; appealStatus: string | null; verifiedAt: string | null }` | `UNAUTHENTICATED`, `NOT_FOUND` |
| `POST` | `/v1/verification/appeals` | Member JWT | `{ narrative: string; contactEmail?: string }` | `{ appealStatus: "submitted"; caseId: string }` | `UNAUTHENTICATED`, `VALIDATION_ERROR`, `CONFLICT`, `UNPROCESSABLE_STATE`, `RATE_LIMITED` |
| `POST` | `/v1/webhooks/persona` | Persona signature | Provider webhook body; framework ingress must extract exactly one nonblank `Persona-Signature` header value and pass the exact raw request body into the raw-request handler, which verifies the signature before JSON parsing and normalization | `{ received: true }` | `PROVIDER_SIGNATURE_INVALID`, `IDEMPOTENCY_CONFLICT`, `VALIDATION_ERROR` |

## Groups

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `POST` | `/v1/groups` | Member JWT | `{ format: GroupFormat; cityId: string; name?: string; intent?: string }` | `GroupResource` | `UNAUTHENTICATED`, `VERIFICATION_REQUIRED`, `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED` |
| `GET` | `/v1/groups/current` | Member JWT | None | `{ groups: GroupResource[]; activeGroupId: string | null }` | `UNAUTHENTICATED` |
| `GET` | `/v1/groups/{groupId}` | Group member | Path `groupId` | `GroupResource` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `NOT_FOUND` |
| `PATCH` | `/v1/groups/{groupId}` | Group member | `{ name?: string; intent?: string; neighborhoodIds?: string[]; availabilityWindows?: Array<{ startsAt: string; endsAt: string; timezone: string }> }` | `GroupResource` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `VALIDATION_ERROR`, `CONFLICT`, `UNPROCESSABLE_STATE` |
| `GET` | `/v1/groups/{groupId}/availability-mesh` | Group member | Path `groupId` | `GroupAvailabilityMeshResource` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `NOT_FOUND` |
| `PUT` | `/v1/groups/{groupId}/availability-windows` | Group member | `{ memberId: string; windows: Array<{ startsAt: string; endsAt: string; timezone: string }> }` | `GroupAvailabilityMeshResource` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `VALIDATION_ERROR`, `CONFLICT`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/groups/{groupId}/invites` | Group member | `{ recipientHint?: string; expiresInHours: number }` | `{ inviteId: string; shareUrl: string; expiresAt: string }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `VERIFICATION_REQUIRED`, `GROUP_INELIGIBLE`, `VALIDATION_ERROR`, `RATE_LIMITED` |
| `POST` | `/v1/groups/{groupId}/invite-relay` | Group member | `{ recipientHint?: string; expiresInHours: number; sourceChannel: "share_link" | "qr_code" | "manual_share" }` | `{ invite: GroupInviteResource; relayEvent: InviteRelayEventResource; shareUrl: string }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `VERIFICATION_REQUIRED`, `GROUP_INELIGIBLE`, `VALIDATION_ERROR`, `RATE_LIMITED` |
| `GET` | `/v1/group-invites/{token}` | Optional member JWT | Path `token` | `{ inviterFirstName: string; groupPreview: Pick<GroupResource, "id" | "format" | "cityId" | "name">; requiresVerification: boolean; expiresAt: string }` | `NOT_FOUND`, `UNPROCESSABLE_STATE`, `RATE_LIMITED` |
| `POST` | `/v1/group-invites/{token}/accept` | Member JWT | `{ consent: true }` | `GroupResource` | `UNAUTHENTICATED`, `VERIFICATION_REQUIRED`, `VALIDATION_ERROR`, `CONFLICT`, `NOT_FOUND`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/group-invites/{token}/decline` | Member JWT | `{ sourceChannel: "share_link" | "qr_code" | "manual_share" }` | `{ invite: GroupInviteResource; relayEvent: InviteRelayEventResource; outboxEvent: null }` | `UNAUTHENTICATED`, `VALIDATION_ERROR`, `CONFLICT`, `NOT_FOUND`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/group-invites/{token}/approval` | Inviter | `{ approve: boolean }` | `{ invite: GroupInviteResource; relayEvent: InviteRelayEventResource }` | `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `CONFLICT`, `NOT_FOUND`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/groups/{groupId}/publish-approvals` | Group member | `{ approve: boolean; visibilityPreviewHash: string }` | `GroupResource` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `GROUP_NOT_COMPLETE`, `VALIDATION_ERROR`, `CONFLICT`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/groups/{groupId}/leave` | Group member | `{ reasonCode?: string; safetyExit?: boolean }` | `{ group: GroupResource; affectedPlanIds: string[]; affectedConversationIds: string[] }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `VALIDATION_ERROR`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/groups/{groupId}/pause` | Group member | `{ reasonCode?: string }` | `GroupResource` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `VALIDATION_ERROR`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/groups/{groupId}/vouches` | Group member | `{ subjectMemberId: string; body: string }` | `{ id: string; moderationStatus: ModerationStatus; subjectApprovedAt: string | null }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `VALIDATION_ERROR`, `MESSAGE_MODERATION_HELD`, `UNPROCESSABLE_STATE` |
| `PATCH` | `/v1/groups/{groupId}/vouches/{vouchId}` | Group member | `{ body?: string; subjectApproved?: boolean; hidden?: boolean }` | `{ id: string; moderationStatus: ModerationStatus; subjectApprovedAt: string | null; hiddenAt: string | null }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `NOT_FOUND`, `VALIDATION_ERROR`, `MESSAGE_MODERATION_HELD` |

## Introductions

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `GET` | `/v1/groups/{groupId}/introductions/daily` | Group member | Query `{ date?: string; format?: GroupFormat }` | `{ setId: string; baselineSize: number; entitlementExtraSize: number; liquidityMode: string; introductions: IntroductionResource[] }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `VERIFICATION_REQUIRED`, `GROUP_NOT_COMPLETE`, `GROUP_INELIGIBLE`, `RATE_LIMITED` |
| `GET` | `/v1/groups/{groupId}/introductions/{introductionId}` | Group member | Path IDs | `IntroductionResource` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `NOT_FOUND`, `INTRODUCTION_EXPIRED`, `INTRODUCTION_UNAVAILABLE` |
| `POST` | `/v1/groups/{groupId}/introductions/{introductionId}/interest` | Group member | `{ clientNonce: string }` | `{ introduction: IntroductionResource; approvalState: "pending_internal" | "sent" | "matched" }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `GROUP_INELIGIBLE`, `INTRODUCTION_EXPIRED`, `INTRODUCTION_UNAVAILABLE`, `IDEMPOTENCY_CONFLICT`, `CONFLICT` |
| `POST` | `/v1/groups/{groupId}/introductions/{introductionId}/interest-approvals` | Group member | `{ approve: boolean }` | `{ introduction: IntroductionResource; approvalState: "declined" | "sent" | "matched" }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `INTRODUCTION_EXPIRED`, `INTERNAL_APPROVAL_REQUIRED`, `CONFLICT`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/groups/{groupId}/introductions/{introductionId}/pass` | Group member | `{ reasonCode?: string }` | `{ introductionId: string; status: "passed" }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `INTRODUCTION_EXPIRED`, `INTRODUCTION_UNAVAILABLE`, `VALIDATION_ERROR` |

## Conversations and Breakouts

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `GET` | `/v1/groups/{groupId}/conversations` | Group member | Query `{ status?: ConversationStatus; cursor?: string }` | `Page<ConversationResource>` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `NOT_FOUND` |
| `GET` | `/v1/conversations/{conversationId}` | Conversation participant | Path `conversationId` | `{ conversation: ConversationResource; messages: Page<MessageResource>; plans: PlanSummaryResource[] }` | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND` |
| `POST` | `/v1/conversations/{conversationId}/messages` | Conversation participant | `{ clientNonce: string; body?: string; mediaAssetIds?: string[] }` | `MessageResource` | `UNAUTHENTICATED`, `FORBIDDEN`, `CONVERSATION_CLOSED`, `VALIDATION_ERROR`, `MESSAGE_MODERATION_HELD`, `MEDIA_NOT_APPROVED`, `RATE_LIMITED`, `IDEMPOTENCY_CONFLICT` |
| `POST` | `/v1/conversations/{conversationId}/read-receipts` | Conversation participant | `{ lastReadMessageId: string }` | `{ ok: true }` | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR` |
| `POST` | `/v1/conversations/{conversationId}/typing` | Conversation participant | `{ isTyping: boolean }` | `{ ok: true }` | `UNAUTHENTICATED`, `FORBIDDEN`, `CONVERSATION_CLOSED`, `RATE_LIMITED` |
| `POST` | `/v1/conversations/{conversationId}/breakout-requests` | Conversation participant | `{ recipientMemberId: string; reason: "message_threshold" | "confirmed_plan" | "mutual_edge" }` | `{ requestId: string; status: "pending"; expiresAt: string }` | `UNAUTHENTICATED`, `FORBIDDEN`, `BREAKOUT_INELIGIBLE`, `CONSENT_REQUIRED`, `CONVERSATION_CLOSED`, `VALIDATION_ERROR`, `RATE_LIMITED` |
| `POST` | `/v1/breakout-requests/{requestId}/respond` | Request recipient | `{ response: "accept" | "decline" }` | `{ requestId: string; status: "accepted" | "declined"; conversationId: string | null }` | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONSENT_REQUIRED`, `CONFLICT`, `UNPROCESSABLE_STATE` |

## Plans and Social Pods

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `POST` | `/v1/conversations/{conversationId}/plans` | Conversation participant | `{ format: PlanFormat; timeOptions: Array<{ startsAt: string; endsAt: string }>; venueOptions?: Array<{ venueId?: string; manualLabel?: string }> }` | `PlanResource` | `UNAUTHENTICATED`, `FORBIDDEN`, `CONVERSATION_CLOSED`, `VALIDATION_ERROR`, `GROUP_INELIGIBLE`, `ENTITLEMENT_REQUIRED` |
| `POST` | `/v1/conversations/{conversationId}/plan-fast-track` | Conversation participant | `{ sourceGroupId: string; format: PlanFormat }` with `Idempotency-Key` | `PlanFastTrackProposalResource` | `UNAUTHENTICATED`, `FORBIDDEN`, `CONVERSATION_CLOSED`, `VALIDATION_ERROR`, `GROUP_INELIGIBLE`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/plan-proposals/{proposalId}/accept` | Conversation participant | `{ selectedTimeOptionId: string; selectedVenueOptionId: string; rsvpDeadlineAt: string }` with `Idempotency-Key` | `PlanResource` | `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `PLAN_NOT_CONFIRMABLE`, `CONFLICT`, `UNPROCESSABLE_STATE` |
| `GET` | `/v1/groups/{groupId}/plans` | Group member | Query `{ status?: PlanStatus; cursor?: string }` | `Page<PlanSummaryResource>` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED` |
| `GET` | `/v1/plans/{planId}` | Plan participant | Path `planId` | `PlanResource` | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND` |
| `PATCH` | `/v1/plans/{planId}` | Plan participant | `{ startsAt?: string; endsAt?: string; venueId?: string; manualVenueName?: string; manualVenueAddress?: string; rsvpDeadlineAt?: string }` | `PlanResource` | `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `PLAN_NOT_CONFIRMABLE`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/plans/{planId}/votes` | Plan participant | `{ optionId: string; voteValue: "yes" | "maybe" | "no" }` | `PlanResource` | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/plans/{planId}/rsvps` | Plan participant | `{ status: "yes" | "no" | "maybe"; reasonCode?: string }` | `PlanResource` | `UNAUTHENTICATED`, `FORBIDDEN`, `RSVP_CLOSED`, `VALIDATION_ERROR`, `PLAN_NOT_CONFIRMABLE` |
| `POST` | `/v1/plans/{planId}/confirm` | Plan participant | `{ selectedOptionId?: string }` | `PlanResource` | `UNAUTHENTICATED`, `FORBIDDEN`, `PLAN_NOT_CONFIRMABLE`, `GROUP_INELIGIBLE`, `VALIDATION_ERROR`, `CONFLICT` |
| `POST` | `/v1/plans/{planId}/cancel` | Plan participant | `{ reasonCode: string; safetyRelated?: boolean }` | `PlanResource` | `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/plans/{planId}/share` | Plan participant | `{ contactLabel: string; contactChannel: string }` | `{ shareId: string; deliveryStatus: "queued" | "sent" }` | `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `RATE_LIMITED`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/plans/{planId}/attendance` | Plan participant | `{ status: "attended" | "missed" | "disputed"; reasonCode?: string }` | `{ attendanceId: string; planId: string; status: string }` | `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `UNPROCESSABLE_STATE` |
| `GET` | `/v1/social-pod-slots` | Member JWT | Query `{ cityId: string; startsAfter?: string; neighborhoodIds?: string[] }` | `Page<PlanSummaryResource>` | `UNAUTHENTICATED`, `VERIFICATION_REQUIRED`, `VALIDATION_ERROR`, `RATE_LIMITED` |
| `POST` | `/v1/groups/{groupId}/social-pod-signups` | Group member | `{ slotId?: string; timeWindows: Array<{ startsAt: string; endsAt: string }>; neighborhoodIds: string[]; vibeCodes: string[]; bringFriend: boolean }` | `{ signupId: string; status: "waitlisted" | "assigned"; plan: PlanSummaryResource | null }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `VERIFICATION_REQUIRED`, `GROUP_NOT_COMPLETE`, `GROUP_INELIGIBLE`, `VALIDATION_ERROR`, `CONFLICT` |

## Debriefs

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `GET` | `/v1/plans/{planId}/debrief` | Plan participant | Path `planId` | `{ debrief: DebriefResource | null; attendees: Array<{ memberId: string; firstName: string; groupId: string }> }` | `UNAUTHENTICATED`, `FORBIDDEN`, `DEBRIEF_NOT_AVAILABLE`, `NOT_FOUND` |
| `POST` | `/v1/plans/{planId}/debriefs` | Plan participant | `{ attendanceStatus: "attended" | "did_not_attend" | "skipped"; qualityRating?: number; safetyConcern: boolean; interests?: Array<{ targetMemberId: string; signal: DebriefSignal }> }` | `{ debrief: DebriefResource; mutualEdges: MutualEdgeResource[] }` | `UNAUTHENTICATED`, `FORBIDDEN`, `DEBRIEF_NOT_AVAILABLE`, `VALIDATION_ERROR`, `CONFLICT`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/debriefs/{debriefId}/learning-consent` | Debrief owner | `{ action: "grant" | "decline" | "revoke" }` | `{ consent: DebriefLearningConsentResource; featureSnapshot: { id: string; consentId: string } | null; deactivatedFeatureSnapshotIds: string[] }` | `UNAUTHENTICATED`, `FORBIDDEN`, `DEBRIEF_NOT_AVAILABLE`, `CONSENT_REQUIRED`, `VALIDATION_ERROR`, `CONFLICT`, `UNPROCESSABLE_STATE` |
| `GET` | `/v1/debriefs/{debriefId}/mutual-results` | Debrief owner | Path `debriefId` | `{ mutualEdges: MutualEdgeResource[] }` | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `MUTUAL_EDGE_NOT_FOUND` |

```typescript
export interface MutualEdgeResource {
  id: string;
  planId: string;
  otherMemberId: string;
  edgeType: "friend" | "crush" | "both";
  revealedAt: string;
}
```

## Safety

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `POST` | `/v1/safety/reports` | Member JWT | `{ surface: string; category: string; targetMemberId?: string; targetGroupId?: string; targetConversationId?: string; targetPlanId?: string; targetVenueId?: string; narrative?: string; evidenceMediaAssetIds?: string[] }` | `{ reportId: string; case: SafetyCaseResource; protectiveActions: string[] }` | `UNAUTHENTICATED`, `VALIDATION_ERROR`, `MEDIA_NOT_APPROVED`, `RATE_LIMITED`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/safety/blocks` | Member JWT | `{ sourceGroupId: string; targetMemberId?: string; targetGroupId?: string; blockScope: "contact" | "distribution" | "plan" | "all"; reasonCode?: string }` | `{ blockId: string; applied: boolean }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `VALIDATION_ERROR`, `CONFLICT`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/safety/consensus-block-votes` | Group member | `{ actingGroupId: string; targetMemberId?: string; targetGroupId?: string; reasonCode?: string }` | `{ voteId: string; thresholdMet: boolean; blockId: string | null }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `VALIDATION_ERROR`, `CONFLICT`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/safety/urgent-actions` | Member JWT | `{ surface: string; groupId?: string; conversationId?: string; planId?: string; action: "share_plan" | "hide_me" | "leave_group" | "contact_support" }` | `{ actionId: string; status: "applied" | "queued"; guidance: string }` | `UNAUTHENTICATED`, `VALIDATION_ERROR`, `GROUP_ACCESS_DENIED`, `UNPROCESSABLE_STATE`, `RATE_LIMITED` |
| `GET` | `/v1/safety/cases/{caseId}` | Reporter or staff | Path `caseId` | `SafetyCaseResource` | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND` |

## Action Queue

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `GET` | `/v1/action-queue` | Member JWT | None | `{ items: ActionQueueItemResource[] }` | `UNAUTHENTICATED`, `FORBIDDEN`, `RATE_LIMITED` |
| `POST` | `/v1/action-queue/{itemId}/dismiss` | Member JWT | Path `itemId` with `Idempotency-Key` | `{ item: ActionQueueItemResource }` | `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `CONFLICT`, `UNPROCESSABLE_STATE` |

## Media

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `POST` | `/v1/media/uploads` | Member JWT | `{ purpose: "profile" | "message" | "venue" | "report_evidence"; groupId?: string; contentType: string; byteSize: number; checksumSha256: string }` | `{ assetId: string; uploadUrl: string; requiredHeaders: Record<string, string>; expiresAt: string }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `VALIDATION_ERROR`, `RATE_LIMITED`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/media/{assetId}/complete` | Asset owner | `{ checksumSha256: string }` | `{ assetId: string; moderationStatus: ModerationStatus; available: boolean }` | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `MEDIA_NOT_APPROVED`, `UNPROCESSABLE_STATE` |
| `GET` | `/v1/media/{assetId}/signed-url` | Authorized viewer | Query `{ variant?: "original" | "thumb" | "profile" }` | `{ url: string; expiresAt: string }` | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `MEDIA_NOT_APPROVED`, `RATE_LIMITED` |

## Notifications

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `GET` | `/v1/notification-settings` | Member JWT | None | `{ enabledCategories: NotificationCategory[]; quietHoursStart: string | null; quietHoursEnd: string | null; lockscreenPrivacy: string }` | `UNAUTHENTICATED` |
| `PATCH` | `/v1/notification-settings` | Member JWT | `{ enabledCategories?: NotificationCategory[]; quietHoursStart?: string | null; quietHoursEnd?: string | null; lockscreenPrivacy?: string }` | `{ enabledCategories: NotificationCategory[]; quietHoursStart: string | null; quietHoursEnd: string | null; lockscreenPrivacy: string }` | `UNAUTHENTICATED`, `VALIDATION_ERROR` |
| `POST` | `/v1/push-tokens` | Member JWT | `{ provider: "apns" | "fcm"; token: string; deviceId: string; platform: "ios" | "android" }` | `{ ok: true }` | `UNAUTHENTICATED`, `VALIDATION_ERROR`, `RATE_LIMITED` |
| `GET` | `/v1/notifications/inbox` | Member JWT | Query `{ cursor?: string }` | `Page<{ id: string; category: NotificationCategory; title: string; body: string; targetPath: string; createdAt: string; readAt: string | null }>` | `UNAUTHENTICATED` |
| `POST` | `/v1/notifications/{notificationId}/read` | Member JWT | Path `notificationId` | `{ ok: true }` | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND` |

## Payments and Entitlements

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `GET` | `/v1/entitlements` | Member JWT | Query `{ groupId?: string }` | `{ memberEntitlements: EntitlementResource[]; groupEntitlements: EntitlementResource[] }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED` |
| `GET` | `/v1/payments/offers` | Member JWT | Query `{ groupId?: string; surface: "subscription" | "premium_plan" }` | `{ offers: Array<{ productCode: string; title: string; priceDisplay: string; renews: boolean; provider: "revenuecat" | "stripe" }> }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `VALIDATION_ERROR` |
| `POST` | `/v1/payments/stripe/payment-intents` | Member JWT | `{ groupId?: string; productCode: string; planId?: string }` | `{ clientSecret: string; purchaseId: string }` | `UNAUTHENTICATED`, `GROUP_ACCESS_DENIED`, `VALIDATION_ERROR`, `ENTITLEMENT_REQUIRED`, `PAYMENT_PROVIDER_ERROR`, `UNPROCESSABLE_STATE` |
| `POST` | `/v1/webhooks/revenuecat` | RevenueCat signature | Provider webhook body | `{ received: true }` | `PROVIDER_SIGNATURE_INVALID`, `IDEMPOTENCY_CONFLICT`, `VALIDATION_ERROR` |
| `POST` | `/v1/webhooks/stripe` | Stripe signature | Provider webhook body | `{ received: true }` | `PROVIDER_SIGNATURE_INVALID`, `IDEMPOTENCY_CONFLICT`, `VALIDATION_ERROR` |

```typescript
export interface EntitlementResource {
  entitlementCode: EntitlementCode;
  scope: "member" | "active_group" | "plan";
  startsAt: string;
  endsAt: string | null;
  metadata: Record<string, unknown>;
}
```

## Staff Moderation API

Staff routes are not exposed to consumer clients. They require staff JWT, device trust, and audit logging.

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `GET` | `/v1/admin/moderation/cases` | Staff JWT + device trust | Query `{ status?: string; severity?: SafetySeverity; cursor?: string }` | `Page<{ id: string; sourceType: string; sourceId: string; severity: SafetySeverity; status: string; createdAt: string }>` | `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR` |
| `POST` | `/v1/admin/moderation/cases/{caseId}/decisions` | Staff JWT + device trust | `{ decision: "approve" | "remove" | "warn" | "restrict" | "suspend" | "ban" | "escalate"; reason: string }` | `{ caseId: string; status: "resolved"; safetyActionIds: string[] }` | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `UNPROCESSABLE_STATE` |
| `GET` | `/v1/admin/safety/reports/{reportId}` | Staff JWT + device trust | Path `reportId` | `{ report: SafetyCaseResource; evidence: Array<{ mediaAssetId: string; signedUrl: string }> }` | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND` |

## Health

| Method | Path | Auth | Request | Response | Errors |
|---|---|---|---|---|---|
| `GET` | `/healthz` | None | None | `{ ok: true }` | None |
| `GET` | `/readyz` | Internal load balancer | None | `{ ok: true; dependencies: Record<string, "ok" | "degraded"> }` | `UNPROCESSABLE_STATE` |

## API Rules

1. All mutating endpoints require `Idempotency-Key` except webhook endpoints, which use provider event IDs.
2. Group-scoped writes verify active group membership, group status, member verification, and safety restrictions in guards before service execution.
3. Read models may include member sub-card data only when the requesting member's group is allowed to see the target group, conversation, plan, or mutual edge.
4. `memberId` query parameters are not accepted on discovery endpoints.
5. Provider webhooks never directly mutate user-visible state without writing a domain event and audit log.
6. Provider webhook signature verification uses exactly one unambiguous provider signature header and the exact raw request body captured by the framework layer; parsed JSON is used only after signature verification succeeds.
7. Payment and entitlement endpoints cannot return ranking priority or visibility-boost controls.
8. Notification settings endpoints configure categories only; notification creation is internal and event-driven.
9. Launchpad is a readiness read model. It never returns Introduction cards, member-scoped dating inventory, compatibility or reliability scores, private verification-provider details, or report narratives.
10. Availability Mesh routes accept stored member-entered windows only. They do not accept or return raw calendar event titles, attendees, notes, links, or locations.

## Open Questions

| Question | Recommended Default | Technical Basis |
|---|---|---|
| Should staff moderation APIs live in the same API service or a separate internal service? | Same codebase, separate internal route group and network access for alpha and beta. | Shared domain guards and faster iteration are more valuable initially; network isolation can be added when moderation staffing grows. |
| Should social-pod slot browsing require a complete social-pod Group or only verified Member status? | Require complete Group for signup; allow verified Members to view non-participant slot summaries. | Viewing non-dating logistics is lower risk, but assignment and RSVP must remain group-owned. |

---
<!-- doc-version: 1.0 -->
