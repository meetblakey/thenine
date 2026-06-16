import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

interface SafetyBlockInput {
  blockId: string;
  sourceGroupId: string;
  sourceMemberId: string;
  targetMemberId?: string;
  targetGroupId?: string;
  blockScope: "contact" | "distribution" | "plan" | "all";
  reasonCode?: string;
  createdAt: string;
}

type SafetyBlockResult = {
  block: Record<string, unknown>;
  response: { blockId: string; applied: true };
  outboxEvent: {
    aggregateType: "safety";
    aggregateId: string;
    eventName: "safety.protective_action_applied";
    eventVersion: 1;
    payload: {
      actionId: string;
      actionType: "block";
      targetType: "member" | "group";
      targetId: string;
    };
  };
};

type SafetyDomainExports = typeof domain & {
  buildSafetyBlock?: (input: SafetyBlockInput) => SafetyBlockResult;
};

const safetyDomain = domain as SafetyDomainExports;

describe("safety block domain", () => {
  it("creates a block with a policy-safe protective action event", () => {
    expect(safetyDomain.buildSafetyBlock).toBeTypeOf("function");

    const result = safetyDomain.buildSafetyBlock?.({
      blockId: "block_1",
      sourceGroupId: "group_1",
      sourceMemberId: "member_reporter",
      targetMemberId: "member_target",
      blockScope: "contact",
      reasonCode: "harassment",
      createdAt: "2026-06-22T12:15:00.000Z"
    });

    expect(result).toMatchObject({
      block: {
        id: "block_1",
        sourceGroupId: "group_1",
        sourceMemberId: "member_reporter",
        targetMemberId: "member_target",
        targetGroupId: null,
        blockScope: "contact",
        createdFrom: "member_action"
      },
      response: { blockId: "block_1", applied: true }
    });
    expect(result?.outboxEvent).toEqual({
      aggregateType: "safety",
      aggregateId: "block_1",
      eventName: "safety.protective_action_applied",
      eventVersion: 1,
      payload: {
        actionId: "block_1",
        actionType: "block",
        targetType: "member",
        targetId: "member_target"
      }
    });
    expect(JSON.stringify(result?.outboxEvent)).not.toContain("member_reporter");
  });

  it("requires exactly one target for direct member blocks", () => {
    expect(safetyDomain.buildSafetyBlock).toBeTypeOf("function");

    expect(() =>
      safetyDomain.buildSafetyBlock?.({
        blockId: "block_2",
        sourceGroupId: "group_1",
        sourceMemberId: "member_reporter",
        blockScope: "contact",
        createdAt: "2026-06-22T12:15:00.000Z"
      })
    ).toThrow(/target/i);
  });
});
