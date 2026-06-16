import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";
import type { PlanResource } from "@thenine/domain";

interface AuthenticatedMember {
  memberId: string;
}

interface PlanMutationContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

interface AttendanceDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadAttendanceAccess: (planId: string, memberId: string) => Promise<{ plan: PlanResource; groupId: string }>;
  nextAttendanceId: () => string;
  now: () => Date;
  persistAttendanceConfirmation: (input: Record<string, unknown>) => Promise<{ attendanceId: string; planId: string; status: string }>;
}

type AttendanceApiExports = typeof api & {
  POST_PLAN_ATTENDANCE_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handlePostPlanAttendance?: (
    context: PlanMutationContext,
    params: { planId: string },
    body: { status: "attended" | "missed" | "disputed"; reasonCode?: string },
    dependencies: AttendanceDependencies
  ) => Promise<{ attendanceId: string; planId: string; status: string }>;
};

const attendanceApi = api as AttendanceApiExports;
const member: AuthenticatedMember = {
  memberId: "member_a"
};

const confirmedPlan = (): PlanResource => ({
  id: "plan_1",
  format: "quartet",
  status: "confirmed",
  startsAt: "2026-06-22T09:00:00.000Z",
  venueName: "Harbour Bar",
  groupIds: ["group_1", "group_2"],
  conversationId: "conversation_1",
  venueId: "venue_1",
  manualVenueName: null,
  manualVenueAddress: null,
  endsAt: "2026-06-22T11:00:00.000Z",
  rsvpDeadlineAt: "2026-06-21T09:00:00.000Z",
  options: [],
  rsvps: []
});

describe("Plan attendance API route", () => {
  it("publishes documented Plan attendance route metadata", () => {
    expect(attendanceApi.POST_PLAN_ATTENDANCE_ROUTE).toEqual({
      method: "POST",
      path: "/v1/plans/{planId}/attendance",
      auth: "Plan participant",
      requiresIdempotencyKey: true
    });
  });

  it("persists participant attendance confirmation", async () => {
    expect(attendanceApi.handlePostPlanAttendance).toBeTypeOf("function");

    const calls: string[] = [];
    const persistAttendanceConfirmation = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("persist-attendance");

      return input.response as { attendanceId: string; planId: string; status: string };
    });

    const result = await attendanceApi.handlePostPlanAttendance?.(
      { member, idempotencyKey: "idem-attendance" },
      { planId: "plan_1" },
      { status: "attended" },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        loadAttendanceAccess: vi.fn(async () => {
          calls.push("access");

          return { plan: confirmedPlan(), groupId: "group_1" };
        }),
        nextAttendanceId: () => "attendance_1",
        now: () => new Date("2026-06-22T11:05:00.000Z"),
        persistAttendanceConfirmation
      }
    );

    expect(calls).toEqual(["idempotency", "access", "persist-attendance"]);
    expect(result).toEqual({ attendanceId: "attendance_1", planId: "plan_1", status: "attended" });
    expect(persistAttendanceConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        attendance: expect.objectContaining({
          confidence: 0.5,
          source: "debrief"
        })
      })
    );
  });

  it("requires idempotency before attendance writes", async () => {
    await expect(
      attendanceApi.handlePostPlanAttendance?.(
        { member, idempotencyKey: null },
        { planId: "plan_1" },
        { status: "attended" },
        {
          reserveIdempotencyKey: vi.fn(),
          loadAttendanceAccess: vi.fn(),
          nextAttendanceId: () => "attendance_1",
          now: () => new Date("2026-06-22T11:05:00.000Z"),
          persistAttendanceConfirmation: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
