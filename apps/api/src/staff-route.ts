import { DomainInvariantError } from "@thenine/domain/group-eligibility";
import {
  buildStaffRestrictedAccessAudit,
  type StaffAccessAuditLogDraft,
  type StaffRole
} from "@thenine/domain/staff-access";
import { ApiRouteError } from "./launchpad-route.js";

export const GET_ADMIN_SAFETY_REPORT_ROUTE = {
  method: "GET",
  path: "/v1/admin/safety/reports/{reportId}",
  auth: "Staff JWT + device trust"
} as const;

export interface StaffRouteActor {
  staffId: string;
  roles: string[];
  deviceTrusted: boolean;
}

export interface StaffRouteContext {
  staff: StaffRouteActor | null;
}

export interface StaffSafetyReportResource {
  report: {
    id: string;
    severity: "S1" | "S2" | "S3" | "S4";
    status: "open" | "assigned" | "resolved" | "appealed";
  };
  evidence: Array<{ mediaAssetId: string; signedUrl: string }>;
}

export interface StaffSafetyReportAccess {
  caseId: string;
  metadata: Record<string, unknown>;
}

export interface StaffSafetyReportDependencies {
  assertStaffSafetyReportAccess: (input: { staffId: string; reportId: string }) => Promise<StaffSafetyReportAccess>;
  nextAuditLogId: () => string;
  now: () => Date;
  persistStaffAuditLog: (input: StaffAccessAuditLogDraft) => Promise<void>;
  loadStaffSafetyReport: (reportId: string) => Promise<StaffSafetyReportResource>;
}

export async function handleGetAdminSafetyReport(
  context: StaffRouteContext,
  params: { reportId: string },
  dependencies: StaffSafetyReportDependencies
): Promise<StaffSafetyReportResource> {
  const staff = requireStaffActor(context.staff);
  const reportId = requireStaffRouteParam(params.reportId, "reportId");
  const role = selectStaffRole(staff.roles);
  const access = await dependencies.assertStaffSafetyReportAccess({ staffId: staff.staffId, reportId });

  try {
    const auditedAccess = buildStaffRestrictedAccessAudit({
      auditLogId: dependencies.nextAuditLogId(),
      staffId: staff.staffId,
      role,
      action: "read",
      resourceType: "safety_report",
      resourceId: reportId,
      reasonCode: "safety_review",
      caseId: access.caseId,
      accessedAt: dependencies.now().toISOString(),
      metadata: access.metadata
    });

    await dependencies.persistStaffAuditLog(auditedAccess.auditLog);
    return await dependencies.loadStaffSafetyReport(reportId);
  } catch (error) {
    throw mapStaffDomainError(error);
  }
}

function requireStaffActor(staff: StaffRouteActor | null): StaffRouteActor {
  if (staff === null) {
    throw new ApiRouteError("UNAUTHENTICATED", "Staff routes require a staff session.");
  }

  if (!staff.deviceTrusted) {
    throw new ApiRouteError("FORBIDDEN", "Staff routes require a trusted device.");
  }

  return staff;
}

function selectStaffRole(roles: string[]): StaffRole {
  if (roles.includes("safety_reviewer")) {
    return "safety_reviewer";
  }

  if (roles.includes("trust_admin")) {
    return "trust_admin";
  }

  if (roles.includes("support_agent")) {
    return "support_agent";
  }

  throw new ApiRouteError("FORBIDDEN", "Staff route requires an authorized staff role.");
}

function requireStaffRouteParam(value: string, fieldName: string): string {
  if (value.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", `Staff route requires ${fieldName}.`);
  }

  return value;
}

function mapStaffDomainError(error: unknown): Error {
  if (error instanceof DomainInvariantError) {
    return new ApiRouteError("FORBIDDEN", error.message);
  }

  return error instanceof Error ? error : new ApiRouteError("UNPROCESSABLE_STATE", "Unexpected staff route failure.");
}
