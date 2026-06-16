import { ContractInvariantError } from "./route-invariants.js";

export const LAUNCHPAD_BLOCKERS = [
  "verification_required",
  "create_or_join_group",
  "invite_pending",
  "profile_required",
  "availability_required",
  "publish_approval_required",
  "moderation_required",
  "safety_paused",
  "eligible_for_first_introduction",
  "thin_city_no_inventory"
] as const;

export const LAUNCHPAD_ACTIONS = [
  "start_verification",
  "create_group",
  "invite_friend",
  "complete_profile",
  "add_availability",
  "approve_visibility",
  "resolve_safety_blocker",
  "open_first_introduction",
  "edit_neighborhoods",
  "join_pod_waitlist"
] as const;

export const LAUNCHPAD_SAFETY_ACTIONS = ["report", "block", "leave", "urgent_help", "share_plan"] as const;

export type LaunchpadBlocker = (typeof LAUNCHPAD_BLOCKERS)[number];
export type LaunchpadActionKind = (typeof LAUNCHPAD_ACTIONS)[number];
export type LaunchpadSafetyActionKind = (typeof LAUNCHPAD_SAFETY_ACTIONS)[number];
export type LaunchpadReadinessStatus =
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

export interface LaunchpadAction {
  kind: LaunchpadActionKind;
  label: string;
  href: string;
  groupId: string | null;
}

export interface LaunchpadSafetyAction {
  kind: LaunchpadSafetyActionKind;
  surface: "launchpad";
  groupId: string | null;
}

export interface LaunchpadResource {
  memberId: string;
  activeGroupId: string | null;
  readinessStatus: LaunchpadReadinessStatus;
  blockers: LaunchpadBlocker[];
  primaryAction: LaunchpadAction;
  secondaryActions: LaunchpadAction[];
  safetyActions: LaunchpadSafetyAction[];
  refreshesAt: string | null;
}

export const LAUNCHPAD_ROUTE_CONTRACT = {
  method: "GET",
  path: "/v1/launchpad",
  auth: "Member JWT",
  scope: "member_acted_group_readiness",
  requestFields: [],
  responseFields: [
    "memberId",
    "activeGroupId",
    "readinessStatus",
    "blockers",
    "primaryAction",
    "secondaryActions",
    "safetyActions",
    "refreshesAt"
  ],
  forbiddenResponseFields: [
    "introductions",
    "memberInventory",
    "recipientMemberId",
    "compatibilityScore",
    "reliabilityScore",
    "providerFailureReason",
    "reportNarrative"
  ],
  safetyActions: LAUNCHPAD_SAFETY_ACTIONS
} as const;

export function assertLaunchpadContract(): void {
  if (LAUNCHPAD_ROUTE_CONTRACT.method !== "GET" || LAUNCHPAD_ROUTE_CONTRACT.path !== "/v1/launchpad") {
    throw new ContractInvariantError("LAUNCHPAD_ROUTE_INVALID", "Launchpad must be a GET /v1/launchpad readiness route.");
  }

  if (LAUNCHPAD_ROUTE_CONTRACT.auth !== "Member JWT") {
    throw new ContractInvariantError("LAUNCHPAD_AUTH_INVALID", "Launchpad must require a member session JWT.");
  }

  const forbiddenResponseFields = new Set<string>(LAUNCHPAD_ROUTE_CONTRACT.forbiddenResponseFields);
  const exposedForbiddenField = LAUNCHPAD_ROUTE_CONTRACT.responseFields.find((field) => forbiddenResponseFields.has(field));

  if (exposedForbiddenField !== undefined) {
    throw new ContractInvariantError(
      "LAUNCHPAD_INVENTORY_RESPONSE_FORBIDDEN",
      "Launchpad must not expose dating inventory, member-recipient discovery, private provider detail, or ranking-only scores."
    );
  }

  if (LAUNCHPAD_ROUTE_CONTRACT.safetyActions.join(",") !== LAUNCHPAD_SAFETY_ACTIONS.join(",")) {
    throw new ContractInvariantError(
      "LAUNCHPAD_SAFETY_ACTIONS_INCOMPLETE",
      "Launchpad must expose report, block, leave, urgent help, and share-plan actions within one tap."
    );
  }
}
