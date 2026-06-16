import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";

interface AuthenticatedMember {
  memberId: string;
}

interface SafetyMutationContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

interface SafetyBlockDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  nextBlockId: () => string;
  now: () => Date;
  persistSafetyBlock: (input: Record<string, unknown>) => Promise<{ blockId: string; applied: true }>;
}

type SafetyApiExports = typeof api & {
  POST_SAFETY_BLOCK_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handlePostSafetyBlock?: (
    context: SafetyMutationContext,
    body: {
      sourceGroupId: string;
      targetMemberId?: string;
      targetGroupId?: string;
      blockScope: "contact" | "distribution" | "plan" | "all";
      reasonCode?: string;
    },
    dependencies: SafetyBlockDependencies
  ) => Promise<{ blockId: string; applied: true }>;
};

const safetyApi = api as SafetyApiExports;
const member: AuthenticatedMember = {
  memberId: "member_reporter"
};

describe("safety block API route", () => {
  it("publishes documented safety block route metadata", () => {
    expect(safetyApi.POST_SAFETY_BLOCK_ROUTE).toEqual({
      method: "POST",
      path: "/v1/safety/blocks",
      auth: "Member JWT",
      requiresIdempotencyKey: true
    });
  });

  it("checks group access before persisting a block action", async () => {
    expect(safetyApi.handlePostSafetyBlock).toBeTypeOf("function");

    const calls: string[] = [];
    const persistSafetyBlock = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("persist-block");

      return input.response as { blockId: string; applied: true };
    });

    const result = await safetyApi.handlePostSafetyBlock?.(
      { member, idempotencyKey: "idem-block" },
      {
        sourceGroupId: "group_1",
        targetMemberId: "member_target",
        blockScope: "contact",
        reasonCode: "harassment"
      },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        assertGroupMemberAccess: vi.fn(async () => {
          calls.push("access");
        }),
        nextBlockId: () => "block_1",
        now: () => new Date("2026-06-22T12:15:00.000Z"),
        persistSafetyBlock
      }
    );

    expect(calls).toEqual(["idempotency", "access", "persist-block"]);
    expect(result).toEqual({ blockId: "block_1", applied: true });
    expect(persistSafetyBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxEvent: {
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
        }
      })
    );
  });

  it("requires idempotency before block writes", async () => {
    await expect(
      safetyApi.handlePostSafetyBlock?.(
        { member, idempotencyKey: null },
        { sourceGroupId: "group_1", targetMemberId: "member_target", blockScope: "contact" },
        {
          reserveIdempotencyKey: vi.fn(),
          assertGroupMemberAccess: vi.fn(),
          nextBlockId: () => "block_1",
          now: () => new Date("2026-06-22T12:15:00.000Z"),
          persistSafetyBlock: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
