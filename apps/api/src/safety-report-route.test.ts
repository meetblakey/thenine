import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";

interface AuthenticatedMember {
  memberId: string;
}

interface SafetyMutationContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

interface SafetyReportDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  assertEvidenceMediaApproved: (mediaAssetIds: string[], memberId: string) => Promise<void>;
  classifySafetyReport: (input: Record<string, unknown>) => Promise<{ caseId: string; severity: "S1" | "S2" | "S3" | "S4"; protectiveActions: string[] }>;
  nextReportId: () => string;
  now: () => Date;
  persistSafetyReportIntake: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

type SafetyApiExports = typeof api & {
  POST_SAFETY_REPORT_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handlePostSafetyReport?: (
    context: SafetyMutationContext,
    body: Record<string, unknown>,
    dependencies: SafetyReportDependencies
  ) => Promise<Record<string, unknown>>;
};

const safetyApi = api as SafetyApiExports;
const member: AuthenticatedMember = {
  memberId: "member_reporter"
};

describe("safety report API route", () => {
  it("publishes documented safety report route metadata", () => {
    expect(safetyApi.POST_SAFETY_REPORT_ROUTE).toEqual({
      method: "POST",
      path: "/v1/safety/reports",
      auth: "Member JWT",
      requiresIdempotencyKey: true
    });
  });

  it("persists report intake with a reporter-private outbox event", async () => {
    expect(safetyApi.handlePostSafetyReport).toBeTypeOf("function");

    const calls: string[] = [];
    const persistSafetyReportIntake = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("persist-report-with-outbox");

      return {
        reportId: "report_1",
        case: input.case,
        protectiveActions: input.protectiveActions
      };
    });

    const result = await safetyApi.handlePostSafetyReport?.(
      { member, idempotencyKey: "idem-report" },
      {
        reporterGroupId: "group_1",
        surface: "chat",
        category: "harassment",
        targetMemberId: "member_target",
        targetConversationId: "conversation_1",
        narrative: "Targeted harassment",
        evidenceMediaAssetIds: ["asset_1"]
      },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        assertEvidenceMediaApproved: vi.fn(async () => {
          calls.push("media");
        }),
        classifySafetyReport: vi.fn(async () => {
          calls.push("classify");

          return { caseId: "case_1", severity: "S2" as const, protectiveActions: ["disable_chat"] };
        }),
        nextReportId: () => "report_1",
        now: () => new Date("2026-06-22T12:10:00.000Z"),
        persistSafetyReportIntake
      }
    );

    expect(calls).toEqual(["idempotency", "media", "classify", "persist-report-with-outbox"]);
    expect(result).toMatchObject({ reportId: "report_1", protectiveActions: ["disable_chat"] });
    expect(persistSafetyReportIntake).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxEvent: {
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
        }
      })
    );
    expect(JSON.stringify((persistSafetyReportIntake.mock.calls[0]?.[0] as { outboxEvent?: unknown }).outboxEvent)).not.toContain("member_reporter");
  });

  it("requires idempotency before report intake", async () => {
    await expect(
      safetyApi.handlePostSafetyReport?.(
        { member, idempotencyKey: null },
        { surface: "chat", category: "harassment", narrative: "Help" },
        {
          reserveIdempotencyKey: vi.fn(),
          assertEvidenceMediaApproved: vi.fn(),
          classifySafetyReport: vi.fn(),
          nextReportId: () => "report_1",
          now: () => new Date("2026-06-22T12:10:00.000Z"),
          persistSafetyReportIntake: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
