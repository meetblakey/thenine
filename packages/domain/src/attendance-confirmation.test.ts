import { describe, expect, it } from "vitest";
import * as domain from "./index.js";
import type { PlanResource } from "./types.js";

interface AttendanceConfirmationInput {
  attendanceId: string;
  plan: PlanResource;
  memberId: string;
  groupId: string;
  status: "attended" | "missed" | "disputed";
  reasonCode?: string;
  createdAt: string;
}

interface AttendanceConfirmationResult {
  attendance: {
    id: string;
    planId: string;
    memberId: string;
    groupId: string;
    status: "attended" | "missed" | "disputed";
    source: "debrief";
    confidence: number;
    reasonCode: string | null;
    createdAt: string;
  };
  response: {
    attendanceId: string;
    planId: string;
    status: string;
  };
}

type AttendanceDomainExports = typeof domain & {
  buildAttendanceConfirmation?: (input: AttendanceConfirmationInput) => AttendanceConfirmationResult;
};

const attendanceDomain = domain as AttendanceDomainExports;

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

describe("attendance confirmation domain", () => {
  it("records attendance from a Plan participant without granting full corroborated credit", () => {
    expect(attendanceDomain.buildAttendanceConfirmation).toBeTypeOf("function");

    const result = attendanceDomain.buildAttendanceConfirmation?.({
      attendanceId: "attendance_1",
      plan: confirmedPlan(),
      memberId: "member_a",
      groupId: "group_1",
      status: "attended",
      createdAt: "2026-06-22T11:05:00.000Z"
    });

    expect(result).toEqual({
      attendance: {
        id: "attendance_1",
        planId: "plan_1",
        memberId: "member_a",
        groupId: "group_1",
        status: "attended",
        source: "debrief",
        confidence: 0.5,
        reasonCode: null,
        createdAt: "2026-06-22T11:05:00.000Z"
      },
      response: {
        attendanceId: "attendance_1",
        planId: "plan_1",
        status: "attended"
      }
    });
  });

  it("rejects attendance for non-participating groups or unconfirmed Plans", () => {
    expect(attendanceDomain.buildAttendanceConfirmation).toBeTypeOf("function");

    expect(() =>
      attendanceDomain.buildAttendanceConfirmation?.({
        attendanceId: "attendance_2",
        plan: confirmedPlan(),
        memberId: "member_a",
        groupId: "group_3",
        status: "attended",
        createdAt: "2026-06-22T11:05:00.000Z"
      })
    ).toThrow(/participant/i);

    expect(() =>
      attendanceDomain.buildAttendanceConfirmation?.({
        attendanceId: "attendance_3",
        plan: { ...confirmedPlan(), status: "polling" },
        memberId: "member_a",
        groupId: "group_1",
        status: "attended",
        createdAt: "2026-06-22T11:05:00.000Z"
      })
    ).toThrow(/confirmed/i);
  });
});
