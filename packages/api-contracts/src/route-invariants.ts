export class ContractInvariantError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ContractInvariantError";
  }
}

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type RecipientScope = "recipientGroupId" | "memberId" | "none";
export type RouteOwnerScope = "member" | "group" | "conversation" | "plan" | "debrief" | "safety" | "provider";

export interface ApiRouteContract {
  method: ApiMethod;
  path: string;
  recipientScope: RecipientScope;
  requestFields: string[];
  queryFields: string[];
  ownerScope?: RouteOwnerScope;
  requiresIdempotencyKey?: boolean;
  isProviderWebhook?: boolean;
  providerReplayProtection?: boolean;
  datingSurface?: boolean;
}

export interface ClientResourceContract {
  name: string;
  fields: string[];
}

export const INTRODUCTION_ROUTE_CONTRACTS: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/v1/groups/{groupId}/introductions/daily",
    recipientScope: "recipientGroupId",
    requestFields: [],
    queryFields: ["date", "format"],
    ownerScope: "group",
    requiresIdempotencyKey: false,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "GET",
    path: "/v1/groups/{groupId}/introductions/{introductionId}",
    recipientScope: "recipientGroupId",
    requestFields: [],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: false,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/groups/{groupId}/introductions/{introductionId}/interest",
    recipientScope: "recipientGroupId",
    requestFields: ["clientNonce"],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/groups/{groupId}/introductions/{introductionId}/interest-approvals",
    recipientScope: "recipientGroupId",
    requestFields: ["approve"],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/groups/{groupId}/introductions/{introductionId}/pass",
    recipientScope: "recipientGroupId",
    requestFields: ["reasonCode"],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  }
];

const P0_MUTATING_ROUTE_CONTRACTS: ApiRouteContract[] = [
  {
    method: "POST",
    path: "/v1/verification/sessions",
    recipientScope: "none",
    requestFields: ["returnUrl", "platform"],
    queryFields: [],
    ownerScope: "member",
    requiresIdempotencyKey: true,
    isProviderWebhook: false
  },
  {
    method: "POST",
    path: "/v1/verification/appeals",
    recipientScope: "none",
    requestFields: ["narrative", "contactEmail"],
    queryFields: [],
    ownerScope: "member",
    requiresIdempotencyKey: true,
    isProviderWebhook: false
  },
  {
    method: "POST",
    path: "/v1/webhooks/persona",
    recipientScope: "none",
    requestFields: [],
    queryFields: [],
    ownerScope: "provider",
    requiresIdempotencyKey: false,
    isProviderWebhook: true,
    providerReplayProtection: true
  },
  {
    method: "POST",
    path: "/v1/groups",
    recipientScope: "none",
    requestFields: ["format", "cityId", "name", "intent"],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/groups/{groupId}/invites",
    recipientScope: "recipientGroupId",
    requestFields: ["recipientHint", "expiresInHours"],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: true,
    isProviderWebhook: false
  },
  {
    method: "PATCH",
    path: "/v1/groups/{groupId}",
    recipientScope: "recipientGroupId",
    requestFields: ["name", "intent", "neighborhoodIds", "availabilityWindows"],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "PUT",
    path: "/v1/groups/{groupId}/availability-windows",
    recipientScope: "recipientGroupId",
    requestFields: ["memberId", "windows"],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/groups/{groupId}/vouches",
    recipientScope: "recipientGroupId",
    requestFields: ["subjectMemberId", "body"],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "PATCH",
    path: "/v1/groups/{groupId}/vouches/{vouchId}",
    recipientScope: "recipientGroupId",
    requestFields: ["body", "subjectApproved", "hidden"],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/group-invites/{token}/accept",
    recipientScope: "recipientGroupId",
    requestFields: ["consent"],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: true,
    isProviderWebhook: false
  },
  {
    method: "POST",
    path: "/v1/groups/{groupId}/publish-approvals",
    recipientScope: "recipientGroupId",
    requestFields: ["approve", "visibilityPreviewHash"],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/groups/{groupId}/leave",
    recipientScope: "recipientGroupId",
    requestFields: ["reasonCode", "safetyExit"],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/groups/{groupId}/pause",
    recipientScope: "recipientGroupId",
    requestFields: ["reasonCode"],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/conversations/{conversationId}/messages",
    recipientScope: "none",
    requestFields: ["clientNonce", "body", "mediaAssetIds"],
    queryFields: [],
    ownerScope: "conversation",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/conversations/{conversationId}/breakout-requests",
    recipientScope: "recipientGroupId",
    requestFields: ["recipientMemberId", "reason"],
    queryFields: [],
    ownerScope: "conversation",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/breakout-requests/{requestId}/respond",
    recipientScope: "recipientGroupId",
    requestFields: ["response"],
    queryFields: [],
    ownerScope: "conversation",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/conversations/{conversationId}/plans",
    recipientScope: "none",
    requestFields: ["format", "timeOptions", "venueOptions"],
    queryFields: [],
    ownerScope: "conversation",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "PATCH",
    path: "/v1/plans/{planId}",
    recipientScope: "recipientGroupId",
    requestFields: ["startsAt", "endsAt", "venueId", "manualVenueName", "manualVenueAddress", "rsvpDeadlineAt"],
    queryFields: [],
    ownerScope: "plan",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/plans/{planId}/votes",
    recipientScope: "recipientGroupId",
    requestFields: ["optionId", "voteValue"],
    queryFields: [],
    ownerScope: "plan",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/plans/{planId}/rsvps",
    recipientScope: "none",
    requestFields: ["status", "reasonCode"],
    queryFields: [],
    ownerScope: "plan",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/plans/{planId}/confirm",
    recipientScope: "recipientGroupId",
    requestFields: ["selectedOptionId"],
    queryFields: [],
    ownerScope: "plan",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/plans/{planId}/share",
    recipientScope: "recipientGroupId",
    requestFields: ["contactLabel", "contactChannel"],
    queryFields: [],
    ownerScope: "plan",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/plans/{planId}/attendance",
    recipientScope: "recipientGroupId",
    requestFields: ["status", "reasonCode"],
    queryFields: [],
    ownerScope: "plan",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/plans/{planId}/debriefs",
    recipientScope: "none",
    requestFields: ["attendanceStatus", "qualityRating", "safetyConcern", "interests"],
    queryFields: [],
    ownerScope: "debrief",
    requiresIdempotencyKey: true,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "POST",
    path: "/v1/safety/reports",
    recipientScope: "none",
    requestFields: [
      "surface",
      "category",
      "targetGroupId",
      "targetConversationId",
      "targetPlanId",
      "targetVenueId",
      "evidenceMediaAssetIds"
    ],
    queryFields: [],
    ownerScope: "safety",
    requiresIdempotencyKey: true,
    isProviderWebhook: false
  },
  {
    method: "POST",
    path: "/v1/safety/blocks",
    recipientScope: "recipientGroupId",
    requestFields: ["sourceGroupId", "targetMemberId", "targetGroupId", "blockScope", "reasonCode"],
    queryFields: [],
    ownerScope: "safety",
    requiresIdempotencyKey: true,
    isProviderWebhook: false
  },
  {
    method: "POST",
    path: "/v1/safety/consensus-block-votes",
    recipientScope: "recipientGroupId",
    requestFields: ["actingGroupId", "targetMemberId", "targetGroupId", "reasonCode"],
    queryFields: [],
    ownerScope: "safety",
    requiresIdempotencyKey: true,
    isProviderWebhook: false
  },
  {
    method: "POST",
    path: "/v1/safety/urgent-actions",
    recipientScope: "none",
    requestFields: ["surface", "groupId", "conversationId", "planId", "action"],
    queryFields: [],
    ownerScope: "safety",
    requiresIdempotencyKey: true,
    isProviderWebhook: false
  }
];

const P0_READ_ROUTE_CONTRACTS: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/v1/verification/status",
    recipientScope: "none",
    requestFields: [],
    queryFields: [],
    ownerScope: "member",
    requiresIdempotencyKey: false,
    isProviderWebhook: false
  },
  {
    method: "GET",
    path: "/v1/groups/current",
    recipientScope: "recipientGroupId",
    requestFields: [],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: false,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "GET",
    path: "/v1/groups/{groupId}",
    recipientScope: "recipientGroupId",
    requestFields: [],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: false,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "GET",
    path: "/v1/group-invites/{token}",
    recipientScope: "none",
    requestFields: [],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: false,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "GET",
    path: "/v1/groups/{groupId}/conversations",
    recipientScope: "recipientGroupId",
    requestFields: [],
    queryFields: ["status", "cursor"],
    ownerScope: "group",
    requiresIdempotencyKey: false,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "GET",
    path: "/v1/conversations/{conversationId}",
    recipientScope: "recipientGroupId",
    requestFields: [],
    queryFields: [],
    ownerScope: "conversation",
    requiresIdempotencyKey: false,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "GET",
    path: "/v1/groups/{groupId}/plans",
    recipientScope: "recipientGroupId",
    requestFields: [],
    queryFields: ["status", "cursor"],
    ownerScope: "group",
    requiresIdempotencyKey: false,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "GET",
    path: "/v1/plans/{planId}",
    recipientScope: "recipientGroupId",
    requestFields: [],
    queryFields: [],
    ownerScope: "plan",
    requiresIdempotencyKey: false,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "GET",
    path: "/v1/plans/{planId}/debrief",
    recipientScope: "recipientGroupId",
    requestFields: [],
    queryFields: [],
    ownerScope: "debrief",
    requiresIdempotencyKey: false,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "GET",
    path: "/v1/debriefs/{debriefId}/mutual-results",
    recipientScope: "none",
    requestFields: [],
    queryFields: [],
    ownerScope: "debrief",
    requiresIdempotencyKey: false,
    isProviderWebhook: false,
    datingSurface: true
  },
  {
    method: "GET",
    path: "/v1/groups/{groupId}/availability-mesh",
    recipientScope: "recipientGroupId",
    requestFields: [],
    queryFields: [],
    ownerScope: "group",
    requiresIdempotencyKey: false,
    isProviderWebhook: false,
    datingSurface: true
  }
];

export const P0_ROUTE_CONTRACTS: ApiRouteContract[] = [
  ...P0_READ_ROUTE_CONTRACTS,
  ...P0_MUTATING_ROUTE_CONTRACTS,
  ...INTRODUCTION_ROUTE_CONTRACTS
];

export const CLIENT_RESOURCE_CONTRACTS: ClientResourceContract[] = [
  {
    name: "MemberResource",
    fields: ["id", "firstName", "cityId", "verificationStatus", "status", "notificationSummary"]
  },
  {
    name: "GroupResource",
    fields: [
      "id",
      "cityId",
      "format",
      "status",
      "name",
      "intent",
      "neighborhoodIds",
      "availabilityWindows",
      "eligibilityStatus",
      "eligibilityBlockers",
      "members"
    ]
  },
  {
    name: "IntroductionResource",
    fields: ["id", "recipientGroupId", "kind", "targetGroup", "targetPlan", "status", "rankPosition", "reasonCodes", "expiresAt"]
  },
  {
    name: "ConversationResource",
    fields: ["id", "kind", "status", "groupIds", "parentConversationId", "lastMessageAt", "participantMemberIds"]
  },
  {
    name: "DebriefResource",
    fields: ["id", "planId", "memberId", "attendanceStatus", "qualityRating", "safetyConcern", "submittedAt"]
  }
];

export function assertNoMemberDiscoveryRoutes(routes: ApiRouteContract[] = INTRODUCTION_ROUTE_CONTRACTS): void {
  const hasMemberDiscoveryRoute = routes.some((route) => {
    const allFields = [...route.requestFields, ...route.queryFields];

    return route.recipientScope === "memberId" || route.path.includes("{memberId}") || allFields.includes("memberId");
  });

  if (hasMemberDiscoveryRoute) {
    throw new ContractInvariantError(
      "MEMBER_DISCOVERY_ROUTE_FORBIDDEN",
      "Dating inventory routes must be group-scoped and must not accept memberId."
    );
  }
}

export function assertMutatingRoutesRequireIdempotency(routes: ApiRouteContract[]): void {
  const hasUnsafeMutation = routes.some(
    (route) => route.method !== "GET" && route.isProviderWebhook !== true && route.requiresIdempotencyKey !== true
  );

  if (hasUnsafeMutation) {
    throw new ContractInvariantError(
      "MUTATION_IDEMPOTENCY_REQUIRED",
      "Mutating API routes must require Idempotency-Key unless they are provider webhooks."
    );
  }
}

export function assertProviderWebhooksUseReplayProtection(routes: ApiRouteContract[]): void {
  const hasWebhookWithoutReplayProtection = routes.some(
    (route) => route.isProviderWebhook === true && route.providerReplayProtection !== true
  );

  if (hasWebhookWithoutReplayProtection) {
    throw new ContractInvariantError(
      "PROVIDER_REPLAY_PROTECTION_REQUIRED",
      "Provider webhook routes must declare provider event replay protection."
    );
  }
}

export function assertP0DatingRoutesAreGroupOwned(routes: ApiRouteContract[]): void {
  const allowedDatingOwners: RouteOwnerScope[] = ["group", "conversation", "plan", "debrief"];
  const hasMemberOwnedDatingRoute = routes.some((route) => {
    if (route.datingSurface !== true) {
      return false;
    }

    return (
      route.recipientScope === "memberId" ||
      route.path.includes("{memberId}") ||
      route.ownerScope === undefined ||
      !allowedDatingOwners.includes(route.ownerScope)
    );
  });

  if (hasMemberOwnedDatingRoute) {
    throw new ContractInvariantError(
      "P0_DATING_ROUTE_MUST_BE_GROUP_OWNED",
      "P0 dating routes must be group, conversation, plan, or debrief scoped."
    );
  }
}

export function assertNoSoloDatingVocabulary(routes: ApiRouteContract[]): void {
  const forbiddenTerms = ["swipe", "swipes", "like", "likes", "feed", "feeds", "boost", "boosts"];
  const hasForbiddenTerm = routes.some((route) => {
    const searchable = [route.path, ...route.requestFields, ...route.queryFields].join(" ").toLowerCase();

    return forbiddenTerms.some((term) => new RegExp(`\\b${term}\\b`, "u").test(searchable));
  });

  if (hasForbiddenTerm) {
    throw new ContractInvariantError(
      "SOLO_DATING_VOCABULARY_FORBIDDEN",
      "API contracts must use group-first Introduction language instead of solo dating vocabulary."
    );
  }
}

export function assertNoRankingScoresInClientResources(resources: ClientResourceContract[]): void {
  const forbiddenFields = ["score", "compatibilityScore", "compatibility_score", "reliabilityScore", "reliability_score"];
  const hasForbiddenField = resources.some((resource) => resource.fields.some((field) => forbiddenFields.includes(field)));

  if (hasForbiddenField) {
    throw new ContractInvariantError(
      "RANKING_SCORE_RESPONSE_FORBIDDEN",
      "Client resource contracts must not expose compatibility or reliability scores."
    );
  }
}
