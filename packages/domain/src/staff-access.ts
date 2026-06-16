import type { StaffAccessInput } from "./types.js";
import { DomainInvariantError } from "./group-eligibility.js";

export type StaffRole = "safety_reviewer" | "trust_admin" | "support_agent";
export type StaffRestrictedAction = "read" | "update";
export type StaffRestrictedResourceType = "safety_report" | "debrief" | "verification_case" | "moderation_case";
export type StaffAccessReasonCode = "safety_review" | "verification_review" | "support_request";

const safetyRestrictedResources = new Set<StaffRestrictedResourceType>(["safety_report", "debrief", "moderation_case"]);
const safetyStaffRoles = new Set<StaffRole>(["safety_reviewer", "trust_admin"]);
const auditMetadataDeniedKeys = new Set([
  "compatibilityScore",
  "reliabilityScore",
  "rawDebriefInterest",
  "debriefInterest",
  "reportNarrative",
  "rawReportNarrative",
  "providerDocument",
  "rawProviderDocument"
]);

export interface StaffRestrictedAccessInput {
  auditLogId: string;
  staffId: string;
  role: StaffRole;
  action: StaffRestrictedAction;
  resourceType: StaffRestrictedResourceType;
  resourceId: string;
  reasonCode: StaffAccessReasonCode;
  caseId?: string;
  accessedAt: string;
  metadata?: Record<string, unknown>;
}

export interface StaffAccessAuditLogDraft {
  id: string;
  actorType: "staff";
  actorId: string;
  action: `staff.${StaffRestrictedResourceType}.${StaffRestrictedAction}`;
  targetType: StaffRestrictedResourceType;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface StaffRestrictedAccessAuditResult {
  auditLog: StaffAccessAuditLogDraft;
  access: StaffAccessInput;
}

export function buildStaffRestrictedAccessAudit(input: StaffRestrictedAccessInput): StaffRestrictedAccessAuditResult {
  if (safetyRestrictedResources.has(input.resourceType) && !safetyStaffRoles.has(input.role)) {
    throw new DomainInvariantError("STAFF_ACCESS_DENIED", "Staff role is not authorized for restricted safety access.");
  }

  if (input.resourceType === "debrief" && (input.reasonCode !== "safety_review" || input.caseId === undefined)) {
    throw new DomainInvariantError("STAFF_ACCESS_DENIED", "Debrief access requires a case-scoped safety need.");
  }

  return {
    auditLog: {
      id: input.auditLogId,
      actorType: "staff",
      actorId: input.staffId,
      action: `staff.${input.resourceType}.${input.action}`,
      targetType: input.resourceType,
      targetId: input.resourceId,
      metadata: buildAuditMetadata(input),
      createdAt: input.accessedAt
    },
    access: {
      staffId: input.staffId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      auditLogId: input.auditLogId
    }
  };
}

function buildAuditMetadata(input: StaffRestrictedAccessInput): Record<string, unknown> {
  const sanitizedMetadata = sanitizeAuditMetadata(input.metadata ?? {});

  return {
    ...sanitizedMetadata,
    role: input.role,
    reasonCode: input.reasonCode,
    ...(input.caseId === undefined ? {} : { caseId: input.caseId }),
    resourceType: input.resourceType
  };
}

function sanitizeAuditMetadata(value: Record<string, unknown>): Record<string, unknown> {
  return sanitizeAuditMetadataValue(value) as Record<string, unknown>;
}

function sanitizeAuditMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditMetadataValue(item));
  }

  if (value !== null && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (!auditMetadataDeniedKeys.has(key)) {
        sanitized[key] = sanitizeAuditMetadataValue(nestedValue);
      }
    }

    return sanitized;
  }

  return value;
}
