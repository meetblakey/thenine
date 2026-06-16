export type VerificationStatus = "not_started" | "pending" | "approved" | "rejected";
export type EligibilityStatus = "eligible" | "ineligible" | "paused";
export type MobileSafetySurface = "group_chat" | "plan" | "debrief";
export type MobileSafetyAction = "report" | "block" | "leave" | "urgent_help" | "share_plan";

export interface MobileActionQueueItem {
  id: string;
  actionKind: string;
  priority: "safety" | "deadline" | "standard";
  targetPath: string;
}

export interface P0HomeInput {
  member: {
    memberId: string;
    verificationStatus: VerificationStatus;
  };
  activeGroup: null | {
    groupId: string;
    eligibilityStatus: EligibilityStatus;
    blockers: string[];
  };
  introductionCount: number;
  upcomingPlanId: string | null;
  actionQueueItems?: MobileActionQueueItem[];
}

export type P0HomeModel =
  | {
      screen: "Identity Verification";
      primaryAction: { kind: "verify_identity" };
      datingInventoryRequest: null;
      safetyActions: [];
    }
  | {
      screen: "Create Group";
      primaryAction: { kind: "complete_group"; blockers: string[] };
      datingInventoryRequest: null;
      safetyActions: [];
    }
  | {
      screen: "Home";
      primaryAction:
        | { kind: "open_action_queue"; itemId: string; targetPath: string }
        | { kind: "open_introductions"; recipientGroupId: string }
        | { kind: "open_plan"; planId: string }
        | { kind: "wait_for_introductions"; recipientGroupId: string };
      datingInventoryRequest: { path: string; recipientGroupId: string } | null;
      safetyActions: MobileSafetyAction[];
      actionQueueItems?: MobileActionQueueItem[];
    };

const requiredSafetyActions: MobileSafetyAction[] = ["report", "block", "leave", "urgent_help", "share_plan"];

export function buildP0HomeModel(input: P0HomeInput): P0HomeModel {
  if (input.member.verificationStatus !== "approved") {
    return {
      screen: "Identity Verification",
      primaryAction: { kind: "verify_identity" },
      datingInventoryRequest: null,
      safetyActions: []
    };
  }

  if (input.activeGroup === null || input.activeGroup.eligibilityStatus !== "eligible") {
    return {
      screen: "Create Group",
      primaryAction: { kind: "complete_group", blockers: input.activeGroup?.blockers ?? ["group_required"] },
      datingInventoryRequest: null,
      safetyActions: []
    };
  }

  const recipientGroupId = input.activeGroup.groupId;
  const actionQueueItems = orderMobileActionQueueItems(input.actionQueueItems ?? []);

  if (actionQueueItems.length > 0) {
    const [firstAction] = actionQueueItems;

    if (firstAction === undefined) {
      throw new Error("Action queue ordering returned no first action.");
    }

    return {
      screen: "Home",
      primaryAction: { kind: "open_action_queue", itemId: firstAction.id, targetPath: firstAction.targetPath },
      datingInventoryRequest: null,
      safetyActions: requiredSafetyActions,
      actionQueueItems
    };
  }

  if (input.upcomingPlanId !== null) {
    return {
      screen: "Home",
      primaryAction: { kind: "open_plan", planId: input.upcomingPlanId },
      datingInventoryRequest: null,
      safetyActions: requiredSafetyActions
    };
  }

  return {
    screen: "Home",
    primaryAction:
      input.introductionCount > 0
        ? { kind: "open_introductions", recipientGroupId }
        : { kind: "wait_for_introductions", recipientGroupId },
    datingInventoryRequest:
      input.introductionCount > 0
        ? {
            path: `/v1/groups/${recipientGroupId}/introductions/daily`,
            recipientGroupId
          }
        : null,
    safetyActions: requiredSafetyActions
  };
}

export function safetyActionsForSurface(surface: MobileSafetySurface): MobileSafetyAction[] {
  void surface;
  return requiredSafetyActions;
}

const actionQueuePriorityRank: Record<MobileActionQueueItem["priority"], number> = {
  safety: 0,
  deadline: 1,
  standard: 2
};

function orderMobileActionQueueItems(items: MobileActionQueueItem[]): MobileActionQueueItem[] {
  return [...items].sort((first, second) => actionQueuePriorityRank[first.priority] - actionQueuePriorityRank[second.priority]);
}
