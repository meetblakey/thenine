import { describe, expect, it } from "vitest";

import { DomainInvariantError } from "./group-eligibility.js";
import { buildStaffRestrictedAccessAudit } from "./staff-access.js";

describe("staff restricted access audit", () => {
  it("builds an audit log draft for safety staff reading a safety report", () => {
    const accessedAt = "2026-06-16T00:00:00.000Z";
    const auditLogId = "00000000-0000-7000-8000-000000000001";
    const resourceId = "00000000-0000-7000-8000-000000000101";

    expect(
      buildStaffRestrictedAccessAudit({
        auditLogId,
        staffId: "staff-1",
        role: "safety_reviewer",
        action: "read",
        resourceType: "safety_report",
        resourceId,
        reasonCode: "safety_review",
        caseId: "case-1",
        accessedAt,
        metadata: {
          surface: "staff_console"
        }
      })
    ).toEqual({
      auditLog: {
        id: auditLogId,
        actorType: "staff",
        actorId: "staff-1",
        action: "staff.safety_report.read",
        targetType: "safety_report",
        targetId: resourceId,
        metadata: {
          role: "safety_reviewer",
          reasonCode: "safety_review",
          caseId: "case-1",
          resourceType: "safety_report",
          surface: "staff_console"
        },
        createdAt: accessedAt
      },
      access: {
        staffId: "staff-1",
        action: "read",
        resourceType: "safety_report",
        resourceId,
        auditLogId
      }
    });
  });

  it("requires case-scoped safety need for staff debrief access", () => {
    expect(() =>
      buildStaffRestrictedAccessAudit({
        auditLogId: "00000000-0000-7000-8000-000000000002",
        staffId: "staff-1",
        role: "safety_reviewer",
        action: "read",
        resourceType: "debrief",
        resourceId: "00000000-0000-7000-8000-000000000202",
        reasonCode: "safety_review",
        accessedAt: "2026-06-16T00:00:00.000Z"
      })
    ).toThrow(new DomainInvariantError("STAFF_ACCESS_DENIED", "Debrief access requires a case-scoped safety need."));
  });

  it("rejects support staff access to restricted safety reports", () => {
    expect(() =>
      buildStaffRestrictedAccessAudit({
        auditLogId: "00000000-0000-7000-8000-000000000003",
        staffId: "staff-2",
        role: "support_agent",
        action: "read",
        resourceType: "safety_report",
        resourceId: "00000000-0000-7000-8000-000000000303",
        reasonCode: "support_request",
        caseId: "case-2",
        accessedAt: "2026-06-16T00:00:00.000Z"
      })
    ).toThrow(
      new DomainInvariantError("STAFF_ACCESS_DENIED", "Staff role is not authorized for restricted safety access.")
    );
  });

  it("omits raw sensitive values from staff audit metadata", () => {
    const result = buildStaffRestrictedAccessAudit({
      auditLogId: "00000000-0000-7000-8000-000000000004",
      staffId: "staff-3",
      role: "safety_reviewer",
      action: "read",
      resourceType: "debrief",
      resourceId: "00000000-0000-7000-8000-000000000404",
      reasonCode: "safety_review",
      caseId: "case-3",
      accessedAt: "2026-06-16T00:00:00.000Z",
      metadata: {
        reportNarrative: "private report text",
        rawDebriefInterest: "crush",
        nested: {
          rawProviderDocument: {
            provider: "persona"
          },
          kept: "ok"
        }
      }
    });

    expect(result.auditLog.metadata).toEqual({
      role: "safety_reviewer",
      reasonCode: "safety_review",
      caseId: "case-3",
      resourceType: "debrief",
      nested: {
        kept: "ok"
      }
    });
  });
});
