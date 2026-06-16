export type MemberStatus = "active" | "suspended" | "banned" | "deleted";
export type VerificationStatus =
  | "not_started"
  | "pending"
  | "retry_required"
  | "approved"
  | "rejected"
  | "appeal_pending";
export type GroupFormat = "quartet" | "social_pod";
export type PlanFormat = "quartet" | "social_pod";
export type GroupStatus =
  | "draft"
  | "pending_member"
  | "pending_publish_approval"
  | "eligible"
  | "paused"
  | "ineligible"
  | "dissolved";
export type IntroductionKind = "quartet_group" | "social_pod_plan";
export type ConversationKind = "group_chat" | "breakout";
export type ConversationStatus = "active" | "write_limited" | "expired" | "closed";
export type PlanStatus =
  | "draft"
  | "polling"
  | "rsvp_requested"
  | "confirmed"
  | "reconfirmation_required"
  | "completed"
  | "canceled"
  | "disputed";
export type DebriefSignal = "friend" | "crush" | "both" | "none" | "skipped";
export type ModerationStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "held_for_review";
export type NotificationCategory =
  | "verification"
  | "group"
  | "introduction"
  | "chat"
  | "plan"
  | "safety"
  | "debrief"
  | "payment";
export type SafetySeverity = "S1" | "S2" | "S3" | "S4";

export interface GroupMemberState {
  memberId: string;
  status: "invited" | "active" | "left" | "removed" | "paused";
  memberStatus: MemberStatus;
  verificationStatus: VerificationStatus;
  publishApprovedAt: string | null;
}

export interface GroupEligibilityInput {
  groupId: string;
  format: GroupFormat;
  status: GroupStatus;
  name: string | null;
  intent: string | null;
  neighborhoodIds: string[];
  availabilityWindows: Array<{ startsAt: string; endsAt: string; timezone: string }>;
  publishApprovedAt: string | null;
  profile: {
    sharedVibe: string | null;
    moderationStatus: ModerationStatus;
    publishedAt: string | null;
  } | null;
  members: GroupMemberState[];
  safetyPaused: boolean;
}

export interface GroupEligibilityResult {
  groupId: string;
  eligible: boolean;
  eligibilityStatus: "eligible" | "ineligible" | "paused";
  blockers: string[];
}

export interface RouteDescriptor {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  accepts: string[];
  returnsDatingInventory: boolean;
}

export interface IntroductionCandidate {
  targetGroupId: string;
  exposureBudget: number;
}

export interface AllocationInput {
  sourceGroupId: string;
  candidateGroupIds: string[];
  freeBaselineSize: number;
  extraStackSize: number;
  exposureBudgetByCandidate: Record<string, number>;
}

export interface AllocationResult {
  selectedCandidateIds: string[];
  baselineCount: number;
  entitlementExtraCount: number;
}

export interface IntroductionRecord {
  id: string;
  recipientGroupId: string;
  kind: IntroductionKind;
  targetGroupId: string | null;
  targetPlanId: string | null;
  rankPosition: number;
  score: number;
  compatibilityScore?: number;
  reasonCodes: string[];
  expiresAt: string;
}

export interface ClientIntroductionResource {
  id: string;
  recipientGroupId: string;
  kind: IntroductionKind;
  targetGroupId?: string;
  targetPlanId?: string;
  rankPosition: number;
  reasonCodes: string[];
  expiresAt: string;
}

export interface ConversationResource {
  id: string;
  kind: ConversationKind;
  status: ConversationStatus;
  groupIds: string[];
  parentConversationId: string | null;
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

export interface DebriefResource {
  id: string;
  planId: string;
  memberId: string;
  attendanceStatus: "attended" | "did_not_attend" | "skipped";
  qualityRating: number | null;
  safetyConcern: boolean;
  submittedAt: string | null;
}

export interface SafetyCaseResource {
  id: string;
  severity: SafetySeverity;
  status: "open" | "assigned" | "resolved" | "appealed";
}

export interface BreakoutRequestState {
  id: string;
  parentConversationId: string;
  requesterMemberId: string;
  recipientMemberId: string;
  requesterGroupId: string;
  recipientGroupId: string;
  status: "pending" | "accepted" | "declined" | "expired" | "blocked";
}

export interface DebriefInterestInput {
  planId: string;
  sourceMemberId: string;
  targetMemberId: string;
  signal: DebriefSignal;
}

export interface MutualDebriefEdge {
  planId: string;
  memberAId: string;
  memberBId: string;
  edgeType: Exclude<DebriefSignal, "none" | "skipped">;
}

export interface RecommendationLearningConsent {
  status: "granted" | "declined" | "revoked";
  grantedAt: string | null;
  revokedAt: string | null;
}

export interface NotificationDecisionInput {
  sourceEventId: string | null;
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  memberId: string;
  groupId: string | null;
  dedupeKey: string | null;
}

export interface NotificationIntentDraft {
  sourceEventId: string;
  memberId: string;
  groupId: string | null;
  category: NotificationCategory;
  templateKey: string;
  dedupeKey: string;
}

export type ActiveSurface = "group" | "introduction" | "group_chat" | "breakout" | "plan" | "debrief";
export type SafetyAction = "report" | "block" | "leave" | "urgent_help" | "share_plan";

export interface ProviderWebhookEnvelope {
  provider: "persona" | "hive" | "onesignal" | "revenuecat" | "stripe";
  signatureVerified: boolean;
  eventId: string | null;
  idempotencyKey: string | null;
}

export interface StaffAccessInput {
  staffId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  auditLogId: string | null;
}
