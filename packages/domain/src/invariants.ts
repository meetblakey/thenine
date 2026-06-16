import type {
  ActiveSurface,
  AllocationInput,
  AllocationResult,
  BreakoutRequestState,
  ClientIntroductionResource,
  ConversationResource,
  DebriefInterestInput,
  GroupEligibilityInput,
  GroupEligibilityResult,
  IntroductionRecord,
  MutualDebriefEdge,
  NotificationDecisionInput,
  NotificationIntentDraft,
  ProviderWebhookEnvelope,
  RecommendationLearningConsent,
  RouteDescriptor,
  SafetyAction,
  StaffAccessInput
} from "./types.js";

const activeSignals = new Set(["friend", "crush", "both"]);
const analyticsDeniedKeys = new Set([
  "compatibilityScore",
  "reliabilityScore",
  "rawDebriefInterest",
  "debriefInterest",
  "reportNarrative",
  "rawReportNarrative",
  "calendarContent",
  "rawCalendarContent",
  "providerDocument",
  "rawProviderDocument"
]);
const rawCalendarKeys = new Set(["eventTitle", "title", "attendees", "notes", "links", "location", "rawLocation", "eventLocation"]);

export function evaluateGroupEligibility(input: GroupEligibilityInput): GroupEligibilityResult {
  const blockers = new Set<string>();
  const activeMembers = input.members.filter((member) => member.status === "active");
  const activeVerifiedMembers = activeMembers.filter(
    (member) => member.memberStatus === "active" && member.verificationStatus === "approved"
  );

  if (input.status === "paused" || input.status === "dissolved") {
    blockers.add("group_not_active");
  }

  if (input.format === "quartet" && activeVerifiedMembers.length !== 2) {
    blockers.add("quartet_requires_exactly_two_active_verified_members");
  }

  if (input.format === "social_pod" && (activeVerifiedMembers.length < 1 || activeVerifiedMembers.length > 2)) {
    blockers.add("social_pod_requires_complete_verified_group");
  }

  if (activeMembers.some((member) => member.memberStatus !== "active")) {
    blockers.add("member_status_not_active");
  }

  if (activeMembers.some((member) => member.verificationStatus !== "approved")) {
    blockers.add("member_verification_not_approved");
  }

  if (
    input.name === null ||
    input.intent === null ||
    input.neighborhoodIds.length === 0 ||
    input.profile === null ||
    input.profile.sharedVibe === null ||
    input.profile.publishedAt === null
  ) {
    blockers.add("profile_required");
  }

  if (input.availabilityWindows.length === 0) {
    blockers.add("availability_required");
  }

  if (input.publishApprovedAt === null || activeMembers.some((member) => member.publishApprovedAt === null)) {
    blockers.add("publish_approval_required");
  }

  if (
    input.profile !== null &&
    input.profile.moderationStatus !== "approved" &&
    input.profile.moderationStatus !== "not_required"
  ) {
    blockers.add("profile_moderation_required");
  }

  if (input.safetyPaused) {
    blockers.add("safety_paused");
  }

  const blockerList = Array.from(blockers);

  return {
    groupId: input.groupId,
    eligible: blockerList.length === 0,
    eligibilityStatus: input.safetyPaused || input.status === "paused" ? "paused" : blockerList.length === 0 ? "eligible" : "ineligible",
    blockers: blockerList
  };
}

export function assertNoMemberScopedDatingInventoryRoutes(routes: RouteDescriptor[]): void {
  const violation = routes.find(
    (route) => route.returnsDatingInventory && (route.path.includes("{memberId}") || route.accepts.includes("memberId"))
  );

  if (violation !== undefined) {
    throw new Error("Member-scoped dating inventory routes are prohibited; use recipientGroupId.");
  }
}

export function allocateIntroductionCandidates(input: AllocationInput): AllocationResult {
  const selectableCandidateIds = input.candidateGroupIds.filter(
    (candidateGroupId) => (input.exposureBudgetByCandidate[candidateGroupId] ?? 0) > 0
  );
  const selectionLimit = Math.max(0, input.freeBaselineSize) + Math.max(0, input.extraStackSize);
  const selectedCandidateIds = selectableCandidateIds.slice(0, selectionLimit);
  const baselineCount = Math.min(Math.max(0, input.freeBaselineSize), selectedCandidateIds.length);

  return {
    selectedCandidateIds,
    baselineCount,
    entitlementExtraCount: selectedCandidateIds.length - baselineCount
  };
}

export function serializeIntroductionForClient(
  introduction: IntroductionRecord
): ClientIntroductionResource {
  return {
    id: introduction.id,
    recipientGroupId: introduction.recipientGroupId,
    kind: introduction.kind,
    ...(introduction.targetGroupId === null ? {} : { targetGroupId: introduction.targetGroupId }),
    ...(introduction.targetPlanId === null ? {} : { targetPlanId: introduction.targetPlanId }),
    rankPosition: introduction.rankPosition,
    reasonCodes: introduction.reasonCodes,
    expiresAt: introduction.expiresAt
  };
}

export function createGroupConversation(_input: {
  conversationId: string;
  groupIds: string[];
  participantMemberIds: string[];
}): ConversationResource {
  if (_input.groupIds.length < 2) {
    throw new Error("Dating conversations must be group-owned by at least two Groups.");
  }

  return {
    id: _input.conversationId,
    kind: "group_chat",
    status: "active",
    groupIds: _input.groupIds,
    parentConversationId: null,
    participantMemberIds: _input.participantMemberIds
  };
}

export function createBreakoutConversation(_input: {
  conversationId: string;
  request: BreakoutRequestState;
  participantMemberIds: string[];
}): ConversationResource {
  if (_input.request.status !== "accepted") {
    throw new Error("Breakout conversations require accepted consent.");
  }

  const requiredParticipantMemberIds = [_input.request.requesterMemberId, _input.request.recipientMemberId].sort();
  const providedParticipantMemberIds = Array.from(new Set(_input.participantMemberIds)).sort();

  if (
    providedParticipantMemberIds.length !== requiredParticipantMemberIds.length ||
    providedParticipantMemberIds.some((memberId, index) => memberId !== requiredParticipantMemberIds[index])
  ) {
    throw new Error("Breakout conversations require exactly the consenting requester and recipient.");
  }

  return {
    id: _input.conversationId,
    kind: "breakout",
    status: "active",
    groupIds: [_input.request.requesterGroupId, _input.request.recipientGroupId],
    parentConversationId: _input.request.parentConversationId,
    participantMemberIds: _input.participantMemberIds
  };
}

export function computeMutualDebriefEdges(
  interests: DebriefInterestInput[]
): MutualDebriefEdge[] {
  const directedInterest = new Map<string, DebriefInterestInput>();

  for (const interest of interests) {
    if (activeSignals.has(interest.signal)) {
      directedInterest.set(debriefDirectionKey(interest.planId, interest.sourceMemberId, interest.targetMemberId), interest);
    }
  }

  const edges = new Map<string, MutualDebriefEdge>();

  for (const interest of directedInterest.values()) {
    const reciprocal = directedInterest.get(
      debriefDirectionKey(interest.planId, interest.targetMemberId, interest.sourceMemberId)
    );

    if (reciprocal === undefined) {
      continue;
    }

    const [memberAId, memberBId] = [interest.sourceMemberId, interest.targetMemberId].sort() as [string, string];
    const edgeKey = `${interest.planId}:${memberAId}:${memberBId}`;

    edges.set(edgeKey, {
      planId: interest.planId,
      memberAId,
      memberBId,
      edgeType: combineDebriefSignals(interest.signal, reciprocal.signal)
    });
  }

  return Array.from(edges.values());
}

export function getVisibleMutualEdgesForMember(_input: {
  viewerMemberId: string;
  edges: MutualDebriefEdge[];
}): MutualDebriefEdge[] {
  return _input.edges.filter((edge) => edge.memberAId === _input.viewerMemberId || edge.memberBId === _input.viewerMemberId);
}

export function canUseDebriefPreferenceForRanking(
  consent: RecommendationLearningConsent | null
): boolean {
  return consent?.status === "granted" && consent.grantedAt !== null && consent.revokedAt === null;
}

export function buildNotificationIntent(
  input: NotificationDecisionInput
): NotificationIntentDraft {
  if (input.sourceEventId === null) {
    throw new Error("Notification intent requires a persisted source event.");
  }

  if (input.dedupeKey === null) {
    throw new Error("Notification intent requires a dedupe key.");
  }

  return {
    sourceEventId: input.sourceEventId,
    memberId: input.memberId,
    groupId: input.groupId,
    category: notificationCategoryForEvent(input.eventName),
    templateKey: input.eventName.replaceAll(".", "_"),
    dedupeKey: input.dedupeKey
  };
}

export function assertSafetyActionsWithinOneTap(_input: {
  surface: ActiveSurface;
  active: boolean;
  actions: SafetyAction[];
}): void {
  if (!_input.active) {
    return;
  }

  const requiredActions = requiredSafetyActionsBySurface[_input.surface];
  const missingActions = requiredActions.filter((action) => !_input.actions.includes(action));

  if (missingActions.length > 0) {
    throw new Error(`Missing one-tap safety actions: ${missingActions.join(", ")}`);
  }
}

export function validateProviderWebhookEnvelope(envelope: ProviderWebhookEnvelope): void {
  if (!envelope.signatureVerified) {
    throw new Error("Provider webhook signature must be verified.");
  }

  if (envelope.eventId === null || envelope.idempotencyKey === null) {
    throw new Error("Provider webhook requires event id and idempotency key.");
  }
}

export function assertStaffAccessAudited(input: StaffAccessInput): void {
  if (input.auditLogId === null) {
    throw new Error("Restricted staff access requires an audit log.");
  }
}

export function sanitizeAnalyticsPayload<T extends Record<string, unknown>>(payload: T): T {
  return sanitizeAnalyticsValue(payload) as T;
}

export function validateCalendarImportPersistable(payload: Record<string, unknown>): void {
  const includesRawCalendarContent = Object.keys(payload).some((key) => rawCalendarKeys.has(key));

  if (includesRawCalendarContent) {
    throw new Error("Raw calendar event content cannot be persisted.");
  }
}

const requiredSafetyActionsBySurface: Record<ActiveSurface, SafetyAction[]> = {
  group: ["report", "block", "leave", "urgent_help", "share_plan"],
  introduction: ["report", "block"],
  group_chat: ["report", "block", "leave", "urgent_help", "share_plan"],
  breakout: ["report", "block", "leave", "urgent_help", "share_plan"],
  plan: ["report", "block", "leave", "urgent_help", "share_plan"],
  debrief: ["report", "block", "leave", "urgent_help", "share_plan"]
};

function debriefDirectionKey(planId: string, sourceMemberId: string, targetMemberId: string): string {
  return `${planId}:${sourceMemberId}->${targetMemberId}`;
}

function combineDebriefSignals(
  firstSignal: DebriefInterestInput["signal"],
  secondSignal: DebriefInterestInput["signal"]
): MutualDebriefEdge["edgeType"] {
  if (firstSignal === "both" || secondSignal === "both") {
    return "both";
  }

  if ((firstSignal === "friend" || firstSignal === "crush") && firstSignal === secondSignal) {
    return firstSignal;
  }

  return "both";
}

function notificationCategoryForEvent(eventName: string): NotificationIntentDraft["category"] {
  const [eventFamily] = eventName.split(".");

  switch (eventFamily) {
    case "verification":
      return "verification";
    case "introduction":
      return "introduction";
    case "chat":
    case "conversation":
      return "chat";
    case "plan":
      return "plan";
    case "safety":
      return "safety";
    case "debrief":
      return "debrief";
    case "payment":
    case "entitlement":
      return "payment";
    default:
      return "group";
  }
}

function sanitizeAnalyticsValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAnalyticsValue(item));
  }

  if (value !== null && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (!analyticsDeniedKeys.has(key)) {
        sanitized[key] = sanitizeAnalyticsValue(nestedValue);
      }
    }

    return sanitized;
  }

  return value;
}
