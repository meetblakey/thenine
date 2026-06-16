import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";

interface StaffRouteContext {
  staff: {
    staffId: string;
    roles: string[];
    deviceTrusted: boolean;
  } | null;
}

interface StaffSafetyReportDependencies {
  assertStaffSafetyReportAccess: (input: {
    staffId: string;
    reportId: string;
  }) => Promise<{ caseId: string; metadata: Record<string, unknown> }>;
  nextAuditLogId: () => string;
  now: () => Date;
  persistStaffAuditLog: (input: Record<string, unknown>) => Promise<void>;
  loadStaffSafetyReport: (reportId: string) => Promise<{
    report: {
      id: string;
      severity: "S1" | "S2" | "S3" | "S4";
      status: "open" | "assigned" | "resolved" | "appealed";
    };
    evidence: Array<{ mediaAssetId: string; signedUrl: string }>;
  }>;
}

type StaffApiExports = typeof api & {
  GET_ADMIN_SAFETY_REPORT_ROUTE?: {
    method: string;
    path: string;
    auth: string;
  };
  handleGetAdminSafetyReport?: (
    context: StaffRouteContext,
    params: { reportId: string },
    dependencies: StaffSafetyReportDependencies
  ) => Promise<{
    report: {
      id: string;
      severity: "S1" | "S2" | "S3" | "S4";
      status: "open" | "assigned" | "resolved" | "appealed";
    };
    evidence: Array<{ mediaAssetId: string; signedUrl: string }>;
  }>;
};

const staffApi = api as StaffApiExports;

describe("staff admin safety report route", () => {
  it("publishes documented staff safety report route metadata", () => {
    expect(staffApi.GET_ADMIN_SAFETY_REPORT_ROUTE).toEqual({
      method: "GET",
      path: "/v1/admin/safety/reports/{reportId}",
      auth: "Staff JWT + device trust"
    });
  });

  it("persists a staff audit log before returning a restricted safety report", async () => {
    expect(staffApi.handleGetAdminSafetyReport).toBeTypeOf("function");

    const calls: string[] = [];
    const persistStaffAuditLog = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("audit");
      expect(JSON.stringify(input)).not.toContain("private narrative");
    });
    const loadStaffSafetyReport = vi.fn(async () => {
      calls.push("load-report");

      return {
        report: {
          id: "report_1",
          severity: "S2" as const,
          status: "assigned" as const
        },
        evidence: [{ mediaAssetId: "asset_1", signedUrl: "https://signed.example/asset_1" }]
      };
    });

    const result = await staffApi.handleGetAdminSafetyReport?.(
      {
        staff: {
          staffId: "staff_1",
          roles: ["safety_reviewer"],
          deviceTrusted: true
        }
      },
      { reportId: "00000000-0000-7000-8000-000000000001" },
      {
        assertStaffSafetyReportAccess: vi.fn(async () => {
          calls.push("access");

          return {
            caseId: "case_1",
            metadata: {
              surface: "staff_console",
              reportNarrative: "private narrative"
            }
          };
        }),
        nextAuditLogId: () => "00000000-0000-7000-8000-000000000101",
        now: () => new Date("2026-06-16T00:00:00.000Z"),
        persistStaffAuditLog,
        loadStaffSafetyReport
      }
    );

    expect(calls).toEqual(["access", "audit", "load-report"]);
    expect(result).toEqual({
      report: {
        id: "report_1",
        severity: "S2",
        status: "assigned"
      },
      evidence: [{ mediaAssetId: "asset_1", signedUrl: "https://signed.example/asset_1" }]
    });
    expect(persistStaffAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "00000000-0000-7000-8000-000000000101",
        actorType: "staff",
        actorId: "staff_1",
        action: "staff.safety_report.read",
        targetType: "safety_report",
        targetId: "00000000-0000-7000-8000-000000000001",
        metadata: {
          role: "safety_reviewer",
          reasonCode: "safety_review",
          caseId: "case_1",
          resourceType: "safety_report",
          surface: "staff_console"
        },
        createdAt: "2026-06-16T00:00:00.000Z"
      })
    );
  });
});
