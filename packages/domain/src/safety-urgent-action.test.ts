import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

interface UrgentSafetyActionInput {
  actionId: string;
  memberId: string;
  surface: string;
  groupId?: string;
  conversationId?: string;
  planId?: string;
  action: "share_plan" | "hide_me" | "leave_group" | "contact_support";
  createdAt: string;
}

type UrgentSafetyActionResult = {
  action: Record<string, unknown>;
  response: { actionId: string; status: "applied" | "queued"; guidance: string };
  outboxEvent: {
    aggregateType: "safety";
    aggregateId: string;
    eventName: "safety.protective_action_applied";
    eventVersion: 1;
    payload: {
      actionId: string;
      actionType: string;
      targetType: string;
      targetId: string;
    };
  };
};

type SafetyDomainExports = typeof domain & {
  buildUrgentSafetyAction?: (input: UrgentSafetyActionInput) => UrgentSafetyActionResult;
};

const safetyDomain = domain as SafetyDomainExports;

describe("urgent safety action domain", () => {
  it("queues share-plan urgent actions with local guidance and policy-safe event payload", () => {
    expect(safetyDomain.buildUrgentSafetyAction).toBeTypeOf("function");

    const result = safetyDomain.buildUrgentSafetyAction?.({
      actionId: "urgent_1",
      memberId: "member_a",
      surface: "plan",
      planId: "plan_1",
      action: "share_plan",
      createdAt: "2026-06-22T12:20:00.000Z"
    });

    expect(result).toMatchObject({
      action: {
        id: "urgent_1",
        memberId: "member_a",
        surface: "plan",
        planId: "plan_1",
        action: "share_plan",
        status: "queued"
      },
      response: {
        actionId: "urgent_1",
        status: "queued",
        guidance: "Share your plan with a trusted contact. If there is immediate danger, contact local emergency services."
      }
    });
    expect(result?.outboxEvent).toEqual({
      aggregateType: "safety",
      aggregateId: "urgent_1",
      eventName: "safety.protective_action_applied",
      eventVersion: 1,
      payload: {
        actionId: "urgent_1",
        actionType: "share_plan",
        targetType: "plan",
        targetId: "plan_1"
      }
    });
    expect(JSON.stringify(result?.outboxEvent)).not.toContain("member_a");
  });

  it("requires plan context for share-plan urgent actions", () => {
    expect(safetyDomain.buildUrgentSafetyAction).toBeTypeOf("function");

    expect(() =>
      safetyDomain.buildUrgentSafetyAction?.({
        actionId: "urgent_2",
        memberId: "member_a",
        surface: "plan",
        action: "share_plan",
        createdAt: "2026-06-22T12:20:00.000Z"
      })
    ).toThrow(/plan/i);
  });
});
