import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

interface AvailabilityWindowInput {
  startsAt: string;
  endsAt: string;
  timezone: string;
}

interface GroupAvailabilityMeshInput {
  groupId: string;
  activeMemberIds: string[];
  memberWindows: Array<{ memberId: string; windows: AvailabilityWindowInput[] }>;
  computedAt: string;
}

interface GroupAvailabilityMeshResult {
  groupId: string;
  complete: boolean;
  missingMemberIds: string[];
  overlapWindows: Array<{
    startsAt: string;
    endsAt: string;
    timezone: string;
    source: "member_entered";
    confirmedByMemberIds: string[];
  }>;
  computedAt: string;
}

type AvailabilityExports = typeof domain & {
  computeGroupAvailabilityMesh?: (input: GroupAvailabilityMeshInput) => GroupAvailabilityMeshResult;
  assertNoRawCalendarContent?: (payload: Record<string, unknown>) => void;
};

const availabilityDomain = domain as AvailabilityExports;

function computeGroupAvailabilityMesh(input: GroupAvailabilityMeshInput): GroupAvailabilityMeshResult {
  expect(availabilityDomain.computeGroupAvailabilityMesh).toBeTypeOf("function");

  return availabilityDomain.computeGroupAvailabilityMesh?.(input) as GroupAvailabilityMeshResult;
}

describe("computeGroupAvailabilityMesh", () => {
  it("computes group-level overlap windows from all active member windows", () => {
    const result = computeGroupAvailabilityMesh({
      groupId: "group_1",
      activeMemberIds: ["member_1", "member_2"],
      computedAt: "2026-06-16T12:00:00.000Z",
      memberWindows: [
        {
          memberId: "member_1",
          windows: [
            { startsAt: "2026-06-20T09:00:00.000Z", endsAt: "2026-06-20T12:00:00.000Z", timezone: "Australia/Sydney" }
          ]
        },
        {
          memberId: "member_2",
          windows: [
            { startsAt: "2026-06-20T10:00:00.000Z", endsAt: "2026-06-20T13:00:00.000Z", timezone: "Australia/Sydney" }
          ]
        }
      ]
    });

    expect(result).toEqual({
      groupId: "group_1",
      complete: true,
      missingMemberIds: [],
      computedAt: "2026-06-16T12:00:00.000Z",
      overlapWindows: [
        {
          startsAt: "2026-06-20T10:00:00.000Z",
          endsAt: "2026-06-20T12:00:00.000Z",
          timezone: "Australia/Sydney",
          source: "member_entered",
          confirmedByMemberIds: ["member_1", "member_2"]
        }
      ]
    });
  });

  it("surfaces missing member availability without inventing group windows", () => {
    const result = computeGroupAvailabilityMesh({
      groupId: "group_1",
      activeMemberIds: ["member_1", "member_2"],
      computedAt: "2026-06-16T12:00:00.000Z",
      memberWindows: [
        {
          memberId: "member_1",
          windows: [
            { startsAt: "2026-06-20T09:00:00.000Z", endsAt: "2026-06-20T12:00:00.000Z", timezone: "Australia/Sydney" }
          ]
        }
      ]
    });

    expect(result.complete).toBe(false);
    expect(result.missingMemberIds).toEqual(["member_2"]);
    expect(result.overlapWindows).toEqual([]);
  });

  it("rejects raw calendar event content in P0 availability payloads", () => {
    expect(availabilityDomain.assertNoRawCalendarContent).toBeTypeOf("function");
    expect(() =>
      availabilityDomain.assertNoRawCalendarContent?.({
        eventTitle: "Dinner with Alex",
        attendees: ["alex@example.com"],
        location: "Private apartment"
      })
    ).toThrow(/Raw calendar event content/i);
  });
});
