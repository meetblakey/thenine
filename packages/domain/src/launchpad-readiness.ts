import { computeGroupEligibility } from "./group-eligibility.js";
import type { EligibilityBlocker, GroupEligibilityInput, VerificationStatus } from "./group-eligibility.js";

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

export interface LaunchpadReadinessInput {
  memberId: string;
  memberVerificationStatus: VerificationStatus;
  activeGroup: GroupEligibilityInput | null;
  hasQualifiedIntroductions: boolean;
  nextIntroductionRefreshAt: string | null;
}

export interface LaunchpadAction {
  kind: LaunchpadActionKind;
  label: string;
  href: string;
  groupId: string | null;
}

export interface LaunchpadSafetyAction {
  kind: "report" | "block" | "leave" | "urgent_help" | "share_plan";
  surface: "launchpad";
  groupId: string | null;
}

export interface LaunchpadReadinessResult {
  memberId: string;
  activeGroupId: string | null;
  readinessStatus: LaunchpadReadinessStatus;
  blockers: LaunchpadBlocker[];
  primaryAction: LaunchpadAction;
  secondaryActions: LaunchpadAction[];
  safetyActions: LaunchpadSafetyAction[];
  refreshesAt: string | null;
}

const blockerPriority: LaunchpadBlocker[] = [
  "invite_pending",
  "profile_required",
  "availability_required",
  "publish_approval_required",
  "moderation_required",
  "safety_paused"
];

export function computeLaunchpadReadiness(input: LaunchpadReadinessInput): LaunchpadReadinessResult {
  if (input.memberVerificationStatus !== "approved") {
    return buildResult(input, null, "verification_blocked", ["verification_required"], "start_verification");
  }

  if (input.activeGroup === null) {
    return buildResult(input, null, "needs_group", ["create_or_join_group"], "create_group");
  }

  const activeGroupId = input.activeGroup.groupId;
  const groupEligibility = computeGroupEligibility(input.activeGroup);

  if (groupEligibility.status !== "eligible") {
    const blockers = mapEligibilityBlockers(groupEligibility.blockers);
    const primaryBlocker = blockers[0] ?? "profile_required";
    const primaryActionKind = actionForBlocker(primaryBlocker);
    const secondaryActions = blockers
      .slice(1)
      .map((blocker) => actionForBlocker(blocker))
      .filter((actionKind, index, actionKinds) => actionKinds.indexOf(actionKind) === index)
      .slice(0, 2)
      .map((actionKind) => buildAction(actionKind, activeGroupId));

    return {
      ...buildResult(input, activeGroupId, statusForBlocker(primaryBlocker), blockers, primaryActionKind),
      secondaryActions
    };
  }

  if (input.hasQualifiedIntroductions) {
    return buildResult(
      input,
      activeGroupId,
      "eligible",
      ["eligible_for_first_introduction"],
      "open_first_introduction"
    );
  }

  return {
    ...buildResult(input, activeGroupId, "thin_city_waiting", ["thin_city_no_inventory"], "edit_neighborhoods"),
    secondaryActions: [buildAction("add_availability", activeGroupId), buildAction("join_pod_waitlist", activeGroupId)]
  };
}

function buildResult(
  input: LaunchpadReadinessInput,
  activeGroupId: string | null,
  readinessStatus: LaunchpadReadinessStatus,
  blockers: LaunchpadBlocker[],
  primaryActionKind: LaunchpadActionKind
): LaunchpadReadinessResult {
  return {
    memberId: input.memberId,
    activeGroupId,
    readinessStatus,
    blockers,
    primaryAction: buildAction(primaryActionKind, activeGroupId),
    secondaryActions: [],
    safetyActions: buildSafetyActions(activeGroupId),
    refreshesAt: input.nextIntroductionRefreshAt
  };
}

function mapEligibilityBlockers(blockers: EligibilityBlocker[]): LaunchpadBlocker[] {
  const mappedBlockers = new Set<LaunchpadBlocker>();

  for (const blocker of blockers) {
    mappedBlockers.add(mapEligibilityBlocker(blocker));
  }

  return blockerPriority.filter((blocker) => mappedBlockers.has(blocker));
}

function mapEligibilityBlocker(blocker: EligibilityBlocker): LaunchpadBlocker {
  switch (blocker) {
    case "quartet_requires_two_active_verified_members":
    case "social_pod_requires_complete_verified_group":
    case "member_verification_required":
      return "invite_pending";
    case "profile_required":
      return "profile_required";
    case "availability_required":
      return "availability_required";
    case "publish_approval_required":
      return "publish_approval_required";
    case "profile_moderation_required":
      return "moderation_required";
    case "member_status_required":
    case "group_not_active":
    case "safety_paused":
      return "safety_paused";
  }
}

function statusForBlocker(blocker: LaunchpadBlocker): LaunchpadReadinessStatus {
  switch (blocker) {
    case "verification_required":
      return "verification_blocked";
    case "create_or_join_group":
      return "needs_group";
    case "invite_pending":
      return "needs_group_member";
    case "profile_required":
      return "needs_profile";
    case "availability_required":
      return "needs_availability";
    case "publish_approval_required":
      return "needs_publish_approval";
    case "moderation_required":
      return "blocked_by_moderation";
    case "safety_paused":
      return "blocked_by_safety";
    case "eligible_for_first_introduction":
      return "eligible";
    case "thin_city_no_inventory":
      return "thin_city_waiting";
  }
}

function actionForBlocker(blocker: LaunchpadBlocker): LaunchpadActionKind {
  switch (blocker) {
    case "verification_required":
      return "start_verification";
    case "create_or_join_group":
      return "create_group";
    case "invite_pending":
      return "invite_friend";
    case "profile_required":
      return "complete_profile";
    case "availability_required":
      return "add_availability";
    case "publish_approval_required":
      return "approve_visibility";
    case "moderation_required":
    case "safety_paused":
      return "resolve_safety_blocker";
    case "eligible_for_first_introduction":
      return "open_first_introduction";
    case "thin_city_no_inventory":
      return "edit_neighborhoods";
  }
}

function buildAction(kind: LaunchpadActionKind, groupId: string | null): LaunchpadAction {
  return {
    kind,
    label: actionLabel(kind),
    href: actionHref(kind, groupId),
    groupId
  };
}

function buildSafetyActions(groupId: string | null): LaunchpadSafetyAction[] {
  if (groupId === null) {
    return [];
  }

  return [
    { kind: "report", surface: "launchpad", groupId },
    { kind: "block", surface: "launchpad", groupId },
    { kind: "leave", surface: "launchpad", groupId },
    { kind: "urgent_help", surface: "launchpad", groupId },
    { kind: "share_plan", surface: "launchpad", groupId }
  ];
}

function actionLabel(kind: LaunchpadActionKind): string {
  switch (kind) {
    case "start_verification":
      return "Start verification";
    case "create_group":
      return "Create group";
    case "invite_friend":
      return "Invite friend";
    case "complete_profile":
      return "Complete profile";
    case "add_availability":
      return "Add availability";
    case "approve_visibility":
      return "Approve visibility";
    case "resolve_safety_blocker":
      return "Resolve blocker";
    case "open_first_introduction":
      return "Open first Introduction";
    case "edit_neighborhoods":
      return "Edit neighborhoods";
    case "join_pod_waitlist":
      return "Join pod waitlist";
  }
}

function actionHref(kind: LaunchpadActionKind, groupId: string | null): string {
  switch (kind) {
    case "start_verification":
      return "/verification";
    case "create_group":
      return "/groups/new";
    case "invite_friend":
      return groupId === null ? "/groups/new" : `/groups/${groupId}/invites`;
    case "complete_profile":
      return groupId === null ? "/groups/new" : `/groups/${groupId}/profile`;
    case "add_availability":
      return groupId === null ? "/groups/new" : `/groups/${groupId}/availability`;
    case "approve_visibility":
      return groupId === null ? "/groups/new" : `/groups/${groupId}/publish-approval`;
    case "resolve_safety_blocker":
      return "/safety";
    case "open_first_introduction":
      return groupId === null ? "/groups" : `/groups/${groupId}/introductions`;
    case "edit_neighborhoods":
      return groupId === null ? "/groups" : `/groups/${groupId}/profile/neighborhoods`;
    case "join_pod_waitlist":
      return "/social-pods";
  }
}
