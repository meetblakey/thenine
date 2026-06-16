import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

interface SafetyReportInput {
  reportId: string;
  caseId: string;
  reporterMemberId: string;
  reporterGroupId: string | null;
  surface: "profile" | "chat" | "plan" | "debrief" | "venue" | "safety_center";
  category: "harassment" | "impersonation" | "sexual_content" | "threat" | "discrimination" | "scam" | "underage" | "venue_issue" | "other";
  severity: "S1" | "S2" | "S3" | "S4";
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

interface SafetyReportResult {
  report: Record<string, unknown>;
  case: {
    id: string;
    severity: "S1" | "S2" | "S3" | "S4";
    status: "open";
  };
  protectiveActions: string[];
  outboxEvent: {
    aggregateType: "safety";
    aggregateId: string;
    eventName: "safety.report_received";
    eventVersion: 1;
    payload: {
      reportId: string;
      caseId: string;
      severity: "S1" | "S2" | "S3" | "S4";
      protectiveActions: string[];
    };
  };
}

type SafetyDomainExports = typeof domain & {
  buildSafetyReportIntake?: (input: SafetyReportInput) => SafetyReportResult;
};

const safetyDomain = domain as SafetyDomainExports;

describe("safety report domain", () => {
  it("creates a reporter-private safety report event without exposing reporter identity", () => {
    expect(safetyDomain.buildSafetyReportIntake).toBeTypeOf("function");

    const result = safetyDomain.buildSafetyReportIntake?.({
      reportId: "report_1",
      caseId: "case_1",
      reporterMemberId: "member_reporter",
      reporterGroupId: "group_1",
      surface: "chat",
      category: "harassment",
      severity: "S2",
      protectiveActions: ["disable_chat"],
      targetMemberId: "member_target",
      targetConversationId: "conversation_1",
      narrative: "Targeted harassment",
      evidenceMediaAssetIds: ["asset_1"],
      createdAt: "2026-06-22T12:10:00.000Z"
    });

    expect(result).toMatchObject({
      report: {
        id: "report_1",
        reporterMemberId: "member_reporter",
        reporterGroupId: "group_1",
        targetMemberId: "member_target",
        targetConversationId: "conversation_1",
        surface: "chat",
        category: "harassment",
        severity: "S2",
        status: "received"
      },
      case: {
        id: "case_1",
        severity: "S2",
        status: "open"
      },
      protectiveActions: ["disable_chat"]
    });
    expect(result?.outboxEvent).toEqual({
      aggregateType: "safety",
      aggregateId: "report_1",
      eventName: "safety.report_received",
      eventVersion: 1,
      payload: {
        reportId: "report_1",
        caseId: "case_1",
        severity: "S2",
        protectiveActions: ["disable_chat"]
      }
    });
    expect(JSON.stringify(result?.outboxEvent)).not.toContain("member_reporter");
    expect(JSON.stringify(result?.outboxEvent)).not.toContain("Targeted harassment");
  });

  it("requires a valid report target or narrative", () => {
    expect(safetyDomain.buildSafetyReportIntake).toBeTypeOf("function");

    expect(() =>
      safetyDomain.buildSafetyReportIntake?.({
        reportId: "report_2",
        caseId: "case_2",
        reporterMemberId: "member_reporter",
        reporterGroupId: null,
        surface: "safety_center",
        category: "other",
        severity: "S4",
        protectiveActions: [],
        createdAt: "2026-06-22T12:10:00.000Z"
      })
    ).toThrow(/target or narrative/i);
  });
});
