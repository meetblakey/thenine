import { describe, expect, it } from "vitest";
import * as mobile from "./index.js";

type MobileExports = typeof mobile & {
  buildP0HomeModel?: (input: {
    member: { memberId: string; verificationStatus: "not_started" | "pending" | "approved" | "rejected" };
    activeGroup: null | { groupId: string; eligibilityStatus: "eligible" | "ineligible" | "paused"; blockers: string[] };
    introductionCount: number;
    upcomingPlanId: string | null;
    actionQueueItems?: Array<{ id: string; actionKind: string; priority: "safety" | "deadline" | "standard"; targetPath: string }>;
  }) => Record<string, unknown>;
  safetyActionsForSurface?: (surface: "group_chat" | "plan" | "debrief") => string[];
};

const mobileApi = mobile as MobileExports;

describe("P0 mobile view model", () => {
  it("blocks dating inventory before verification or complete Group eligibility", () => {
    expect(mobileApi.buildP0HomeModel).toBeTypeOf("function");

    expect(
      mobileApi.buildP0HomeModel?.({
        member: { memberId: "member_1", verificationStatus: "pending" },
        activeGroup: null,
        introductionCount: 0,
        upcomingPlanId: null
      })
    ).toEqual({
      screen: "Identity Verification",
      primaryAction: { kind: "verify_identity" },
      datingInventoryRequest: null,
      safetyActions: []
    });

    expect(
      mobileApi.buildP0HomeModel?.({
        member: { memberId: "member_1", verificationStatus: "approved" },
        activeGroup: { groupId: "group_1", eligibilityStatus: "ineligible", blockers: ["member_verification_required"] },
        introductionCount: 0,
        upcomingPlanId: null
      })
    ).toMatchObject({
      screen: "Create Group",
      datingInventoryRequest: null
    });
  });

  it("opens introductions only through recipientGroupId", () => {
    expect(mobileApi.buildP0HomeModel).toBeTypeOf("function");

    const model = mobileApi.buildP0HomeModel?.({
      member: { memberId: "member_1", verificationStatus: "approved" },
      activeGroup: { groupId: "group_1", eligibilityStatus: "eligible", blockers: [] },
      introductionCount: 3,
      upcomingPlanId: null
    });

    expect(model).toEqual({
      screen: "Home",
      primaryAction: { kind: "open_introductions", recipientGroupId: "group_1" },
      datingInventoryRequest: { path: "/v1/groups/group_1/introductions/daily", recipientGroupId: "group_1" },
      safetyActions: ["report", "block", "leave", "urgent_help", "share_plan"]
    });
    expect(JSON.stringify(model)).not.toContain("memberId");
  });

  it("keeps one-tap safety actions on active chat, plan, and debrief surfaces", () => {
    expect(mobileApi.safetyActionsForSurface).toBeTypeOf("function");

    expect(mobileApi.safetyActionsForSurface?.("group_chat")).toEqual(["report", "block", "leave", "urgent_help", "share_plan"]);
    expect(mobileApi.safetyActionsForSurface?.("plan")).toEqual(["report", "block", "leave", "urgent_help", "share_plan"]);
    expect(mobileApi.safetyActionsForSurface?.("debrief")).toEqual(["report", "block", "leave", "urgent_help", "share_plan"]);
  });

  it("prioritizes persisted Momentum Hub actions on Home", () => {
    expect(mobileApi.buildP0HomeModel).toBeTypeOf("function");

    expect(
      mobileApi.buildP0HomeModel?.({
        member: { memberId: "member_1", verificationStatus: "approved" },
        activeGroup: { groupId: "group_1", eligibilityStatus: "eligible", blockers: [] },
        introductionCount: 3,
        upcomingPlanId: null,
        actionQueueItems: [
          { id: "rsvp", actionKind: "rsvp_plan", priority: "deadline", targetPath: "/plans/plan_1" },
          { id: "safety", actionKind: "review_safety_update", priority: "safety", targetPath: "/safety/case_1" }
        ]
      })
    ).toMatchObject({
      screen: "Home",
      primaryAction: { kind: "open_action_queue", itemId: "safety", targetPath: "/safety/case_1" },
      datingInventoryRequest: null,
      actionQueueItems: [
        { id: "safety", actionKind: "review_safety_update", priority: "safety", targetPath: "/safety/case_1" },
        { id: "rsvp", actionKind: "rsvp_plan", priority: "deadline", targetPath: "/plans/plan_1" }
      ]
    });
  });
});
