import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

interface GroupLeaveMembership {
  memberId: string;
  role: "creator" | "member";
  status: "active" | "left";
  verificationStatus: "approved";
  publishApprovedAt: string | null;
  leftAt?: string | null;
  leaveReasonCode?: string | null;
}

interface GroupLeaveDraft {
  id: string;
  cityId: string;
  format: "quartet" | "social_pod";
  status: "draft" | "pending_member" | "pending_publish_approval" | "eligible" | "paused" | "ineligible" | "dissolved";
  createdByMemberId: string;
  name: string | null;
  intent: string | null;
  memberships: GroupLeaveMembership[];
}

interface GroupLeaveResult {
  group: GroupLeaveDraft;
  affectedPlanIds: string[];
  affectedConversationIds: string[];
  outboxEvents: Array<{
    aggregateType: "group";
    aggregateId: string;
    eventName: string;
    eventVersion: 1;
    payload: Record<string, unknown>;
  }>;
}

type GroupLeaveExports = typeof domain & {
  leaveGroup?: (input: {
    group: GroupLeaveDraft;
    memberId: string;
    leftAt: string;
    reasonCode?: string;
    safetyExit?: boolean;
    affectedPlanIds: string[];
    affectedConversationIds: string[];
  }) => GroupLeaveResult;
};

const groupLeave = domain as GroupLeaveExports;

const eligibleGroup = (): GroupLeaveDraft => ({
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

describe("group leave domain", () => {
  it("marks the member left, makes the group ineligible, and emits neutral persisted events", () => {
    expect(groupLeave.leaveGroup).toBeTypeOf("function");

    const result = groupLeave.leaveGroup?.({
      group: eligibleGroup(),
      memberId: "member_1",
      leftAt: "2026-06-16T08:00:00.000Z",
      reasonCode: "safety_exit",
      safetyExit: true,
      affectedPlanIds: ["plan_1"],
      affectedConversationIds: ["conversation_1"]
    });

    expect(result).toMatchObject({
      group: {
        id: "group_1",
        status: "ineligible",
        memberships: [
          {
            memberId: "member_1",
            status: "left",
            leftAt: "2026-06-16T08:00:00.000Z",
            leaveReasonCode: "safety_exit"
          },
          { memberId: "member_2", status: "active" }
        ]
      },
      affectedPlanIds: ["plan_1"],
      affectedConversationIds: ["conversation_1"]
    });
    expect(result?.outboxEvents).toEqual([
      {
        aggregateType: "group",
        aggregateId: "group_1",
        eventName: "group.member_left",
        eventVersion: 1,
        payload: {
          groupId: "group_1",
          memberId: "member_1",
          affectedPlanIds: ["plan_1"],
          affectedConversationIds: ["conversation_1"]
        }
      },
      {
        aggregateType: "group",
        aggregateId: "group_1",
        eventName: "group.eligibility_changed",
        eventVersion: 1,
        payload: {
          groupId: "group_1",
          status: "ineligible",
          eligibilityStatus: "ineligible",
          blockers: ["quartet_requires_two_active_verified_members"]
        }
      }
    ]);
    expect(JSON.stringify(result?.outboxEvents)).not.toMatch(/safety_exit|reasonCode|safetyExit/i);
  });

  it("rejects a leave request from a member who is not active in the group", () => {
    expect(() =>
      groupLeave.leaveGroup?.({
        group: eligibleGroup(),
        memberId: "member_3",
        leftAt: "2026-06-16T08:00:00.000Z",
        affectedPlanIds: [],
        affectedConversationIds: []
      })
    ).toThrow(expect.objectContaining({ code: "GROUP_ACCESS_DENIED" }));
  });

  it("rejects a leave request for a membership that has already left", () => {
    const group = eligibleGroup();
    const creatorMembership = group.memberships[0];
    if (creatorMembership === undefined) {
      throw new Error("Expected eligibleGroup fixture to include a creator membership.");
    }

    group.memberships[0] = {
      ...creatorMembership,
      status: "left",
      leftAt: "2026-06-15T08:00:00.000Z",
      leaveReasonCode: "personal"
    };

    expect(() =>
      groupLeave.leaveGroup?.({
        group,
        memberId: "member_1",
        leftAt: "2026-06-16T08:00:00.000Z",
        affectedPlanIds: [],
        affectedConversationIds: []
      })
    ).toThrow(expect.objectContaining({ code: "UNPROCESSABLE_STATE" }));
  });
});
