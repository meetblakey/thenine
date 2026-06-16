import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

interface GroupPauseMembership {
  memberId: string;
  role: "creator" | "member";
  status: "active" | "left";
  verificationStatus: "approved";
  publishApprovedAt: string | null;
}

interface GroupPauseDraft {
  id: string;
  cityId: string;
  format: "quartet" | "social_pod";
  status: "draft" | "pending_member" | "pending_publish_approval" | "eligible" | "paused" | "ineligible" | "dissolved";
  createdByMemberId: string;
  name: string | null;
  intent: string | null;
  memberships: GroupPauseMembership[];
}

interface GroupPauseResult {
  group: GroupPauseDraft;
  outboxEvents: Array<{
    aggregateType: "group";
    aggregateId: string;
    eventName: string;
    eventVersion: 1;
    payload: Record<string, unknown>;
  }>;
}

type GroupPauseExports = typeof domain & {
  pauseGroup?: (input: { group: GroupPauseDraft; memberId: string; pausedAt: string; reasonCode?: string }) => GroupPauseResult;
};

const groupPause = domain as GroupPauseExports;

const eligibleGroup = (): GroupPauseDraft => ({
  id: "group_1",
  cityId: "city_1",
  format: "quartet",
  status: "eligible",
  createdByMemberId: "member_1",
  name: "Sunday Table",
  intent: "serious",
  memberships: [
    {
      memberId: "member_1",
      role: "creator",
      status: "active",
      verificationStatus: "approved",
      publishApprovedAt: "2026-06-15T10:00:00.000Z"
    },
    {
      memberId: "member_2",
      role: "member",
      status: "active",
      verificationStatus: "approved",
      publishApprovedAt: "2026-06-15T10:05:00.000Z"
    }
  ]
});

describe("group pause domain", () => {
  it("pauses distribution while keeping active memberships and emitting persisted state events", () => {
    expect(groupPause.pauseGroup).toBeTypeOf("function");

    const result = groupPause.pauseGroup?.({
      group: eligibleGroup(),
      memberId: "member_1",
      pausedAt: "2026-06-16T08:00:00.000Z",
      reasonCode: "need_a_break"
    });

    expect(result?.group).toMatchObject({
      id: "group_1",
      status: "paused",
      memberships: [
        { memberId: "member_1", status: "active" },
        { memberId: "member_2", status: "active" }
      ]
    });
    expect(result?.outboxEvents).toEqual([
      {
        aggregateType: "group",
        aggregateId: "group_1",
        eventName: "group.paused",
        eventVersion: 1,
        payload: {
          groupId: "group_1",
          pausedByMemberId: "member_1",
          pausedAt: "2026-06-16T08:00:00.000Z"
        }
      },
      {
        aggregateType: "group",
        aggregateId: "group_1",
        eventName: "group.eligibility_changed",
        eventVersion: 1,
        payload: {
          groupId: "group_1",
          status: "paused",
          eligibilityStatus: "paused",
          blockers: ["group_not_active"]
        }
      }
    ]);
    expect(JSON.stringify(result)).not.toMatch(/need_a_break|reasonCode/i);
  });

  it("rejects pause requests from non-active group members", () => {
    expect(() =>
      groupPause.pauseGroup?.({
        group: eligibleGroup(),
        memberId: "member_3",
        pausedAt: "2026-06-16T08:00:00.000Z"
      })
    ).toThrow(expect.objectContaining({ code: "GROUP_ACCESS_DENIED" }));
  });

  it("rejects pause requests for groups that are already not active for distribution", () => {
    expect(() =>
      groupPause.pauseGroup?.({
        group: { ...eligibleGroup(), status: "paused" },
        memberId: "member_1",
        pausedAt: "2026-06-16T08:00:00.000Z"
      })
    ).toThrow(expect.objectContaining({ code: "UNPROCESSABLE_STATE" }));

    expect(() =>
      groupPause.pauseGroup?.({
        group: { ...eligibleGroup(), status: "dissolved" },
        memberId: "member_1",
        pausedAt: "2026-06-16T08:00:00.000Z"
      })
    ).toThrow(expect.objectContaining({ code: "UNPROCESSABLE_STATE" }));
  });
});
