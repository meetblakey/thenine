import { DomainInvariantError } from "./group-eligibility.js";
import type { SafetyCaseResource, SafetySeverity } from "./types.js";

export type SafetyReportSurface = "profile" | "chat" | "plan" | "debrief" | "venue" | "safety_center";
export type SafetyReportCategory =
  | "harassment"
  | "impersonation"
  | "sexual_content"
  | "threat"
  | "discrimination"
  | "scam"
  | "underage"
  | "venue_issue"
  | "other";

export interface SafetyReportInput {
  reportId: string;
  caseId: string;
  reporterMemberId: string;
  reporterGroupId: string | null;
  surface: SafetyReportSurface;
  category: SafetyReportCategory;
  severity: SafetySeverity;
  protectiveActions: string[];
  targetMemberId?: string;
  targetGroupId?: string;
  targetConversationId?: string;
  targetPlanId?: string;
  targetVenueId?: string;
  narrative?: string;
  evidenceMediaAssetIds?: string[];
  createdAt: string;
}

export interface SafetyReportRecord {
  id: string;
  reporterMemberId: string;
  reporterGroupId: string | null;
  targetMemberId: string | null;
  targetGroupId: string | null;
  targetConversationId: string | null;
  targetPlanId: string | null;
  targetVenueId: string | null;
  surface: SafetyReportSurface;
  category: SafetyReportCategory;
  severity: SafetySeverity;
  narrative: string | null;
  evidenceMediaAssetIds: string[];
  status: "received";
  createdAt: string;
}

export interface SafetyReportReceivedEventDraft {
  aggregateType: "safety";
  aggregateId: string;
  eventName: "safety.report_received";
  eventVersion: 1;
  payload: {
    reportId: string;
    caseId: string;
    severity: SafetySeverity;
    protectiveActions: string[];
  };
}

export interface SafetyReportIntakeResult {
  report: SafetyReportRecord;
  case: SafetyCaseResource;
  protectiveActions: string[];
  outboxEvent: SafetyReportReceivedEventDraft;
}

export type SafetyBlockScope = "contact" | "distribution" | "plan" | "all";

export interface SafetyBlockInput {
  blockId: string;
  sourceGroupId: string;
  sourceMemberId: string;
  targetMemberId?: string;
  targetGroupId?: string;
  blockScope: SafetyBlockScope;
  reasonCode?: string;
  createdAt: string;
}

export interface SafetyBlockResult {
  block: {
    id: string;
    sourceGroupId: string;
    sourceMemberId: string;
    targetMemberId: string | null;
    targetGroupId: string | null;
    blockScope: SafetyBlockScope;
    reasonCode: string | null;
    createdFrom: "member_action";
    createdAt: string;
  };
  response: { blockId: string; applied: true };
  outboxEvent: {
    aggregateType: "safety";
    aggregateId: string;
    eventName: "safety.protective_action_applied";
    eventVersion: 1;
    payload: {
      actionId: string;
      actionType: "block";
      targetType: "member" | "group";
      targetId: string;
    };
  };
}

export type UrgentSafetyActionKind = "share_plan" | "hide_me" | "leave_group" | "contact_support";

export interface UrgentSafetyActionInput {
  actionId: string;
  memberId: string;
  surface: string;
  groupId?: string;
  conversationId?: string;
  planId?: string;
  action: UrgentSafetyActionKind;
  createdAt: string;
}

export interface UrgentSafetyActionResult {
  action: {
    id: string;
    memberId: string;
    surface: string;
    groupId: string | null;
    conversationId: string | null;
    planId: string | null;
    action: UrgentSafetyActionKind;
    status: "applied" | "queued";
    createdAt: string;
  };
  response: { actionId: string; status: "applied" | "queued"; guidance: string };
  outboxEvent: {
    aggregateType: "safety";
    aggregateId: string;
    eventName: "safety.protective_action_applied";
    eventVersion: 1;
    payload: {
      actionId: string;
      actionType: string;
      targetType: string;
      targetId: string;
    };
  };
}

export function buildSafetyReportIntake(input: SafetyReportInput): SafetyReportIntakeResult {
  const hasTarget =
    input.targetMemberId !== undefined ||
    input.targetGroupId !== undefined ||
    input.targetConversationId !== undefined ||
    input.targetPlanId !== undefined ||
    input.targetVenueId !== undefined;

  if (!hasTarget && (input.narrative === undefined || input.narrative.trim() === "")) {
    throw new DomainInvariantError("VALIDATION_ERROR", "Safety reports require a target or narrative.");
  }

  return {
    report: {
      id: input.reportId,
      reporterMemberId: input.reporterMemberId,
      reporterGroupId: input.reporterGroupId,
      targetMemberId: input.targetMemberId ?? null,
      targetGroupId: input.targetGroupId ?? null,
      targetConversationId: input.targetConversationId ?? null,
      targetPlanId: input.targetPlanId ?? null,
      targetVenueId: input.targetVenueId ?? null,
      surface: input.surface,
      category: input.category,
      severity: input.severity,
      narrative: input.narrative ?? null,
      evidenceMediaAssetIds: input.evidenceMediaAssetIds ?? [],
      status: "received",
      createdAt: input.createdAt
    },
    case: {
      id: input.caseId,
      severity: input.severity,
      status: "open"
    },
    protectiveActions: input.protectiveActions,
    outboxEvent: {
      aggregateType: "safety",
      aggregateId: input.reportId,
      eventName: "safety.report_received",
      eventVersion: 1,
      payload: {
        reportId: input.reportId,
        caseId: input.caseId,
        severity: input.severity,
        protectiveActions: input.protectiveActions
      }
    }
  };
}

export function buildSafetyBlock(input: SafetyBlockInput): SafetyBlockResult {
  const hasMemberTarget = input.targetMemberId !== undefined;
  const hasGroupTarget = input.targetGroupId !== undefined;

  if (hasMemberTarget === hasGroupTarget) {
    throw new DomainInvariantError("VALIDATION_ERROR", "Safety blocks require exactly one target.");
  }

  const targetType = hasMemberTarget ? "member" : "group";
  const targetId = input.targetMemberId ?? input.targetGroupId;

  if (targetId === undefined) {
    throw new DomainInvariantError("VALIDATION_ERROR", "Safety blocks require a target.");
  }

  return {
    block: {
      id: input.blockId,
      sourceGroupId: input.sourceGroupId,
      sourceMemberId: input.sourceMemberId,
      targetMemberId: input.targetMemberId ?? null,
      targetGroupId: input.targetGroupId ?? null,
      blockScope: input.blockScope,
      reasonCode: input.reasonCode ?? null,
      createdFrom: "member_action",
      createdAt: input.createdAt
    },
    response: {
      blockId: input.blockId,
      applied: true
    },
    outboxEvent: {
      aggregateType: "safety",
      aggregateId: input.blockId,
      eventName: "safety.protective_action_applied",
      eventVersion: 1,
      payload: {
        actionId: input.blockId,
        actionType: "block",
        targetType,
        targetId
      }
    }
  };
}

export function buildUrgentSafetyAction(input: UrgentSafetyActionInput): UrgentSafetyActionResult {
  if (input.action === "share_plan" && input.planId === undefined) {
    throw new DomainInvariantError("VALIDATION_ERROR", "share_plan urgent actions require plan context.");
  }

  const target = urgentActionTarget(input);
  const status = input.action === "share_plan" || input.action === "contact_support" ? "queued" : "applied";
  const guidance =
    input.action === "share_plan"
      ? "Share your plan with a trusted contact. If there is immediate danger, contact local emergency services."
      : "If there is immediate danger, contact local emergency services. Platform support can help with app safety actions.";

  return {
    action: {
      id: input.actionId,
      memberId: input.memberId,
      surface: input.surface,
      groupId: input.groupId ?? null,
      conversationId: input.conversationId ?? null,
      planId: input.planId ?? null,
      action: input.action,
      status,
      createdAt: input.createdAt
    },
    response: {
      actionId: input.actionId,
      status,
      guidance
    },
    outboxEvent: {
      aggregateType: "safety",
      aggregateId: input.actionId,
      eventName: "safety.protective_action_applied",
      eventVersion: 1,
      payload: {
        actionId: input.actionId,
        actionType: input.action,
        targetType: target.targetType,
        targetId: target.targetId
      }
    }
  };
}

function urgentActionTarget(input: UrgentSafetyActionInput): { targetType: string; targetId: string } {
  if (input.planId !== undefined) {
    return { targetType: "plan", targetId: input.planId };
  }

  if (input.conversationId !== undefined) {
    return { targetType: "conversation", targetId: input.conversationId };
  }

  if (input.groupId !== undefined) {
    return { targetType: "group", targetId: input.groupId };
  }

  return { targetType: "member", targetId: input.memberId };
}
