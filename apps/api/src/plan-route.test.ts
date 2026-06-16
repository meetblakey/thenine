import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";

interface AuthenticatedMember {
  memberId: string;
}

interface PlanMutationContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

interface PlanRouteDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadConversationPlanAccess: (
    conversationId: string,
    memberId: string
  ) => Promise<{ conversationStatus: "active" | "write_limited" | "expired" | "closed"; groupIds: string[]; cityId: string }>;
  assertGroupsEligibleForPlan: (groupIds: string[]) => Promise<void>;
  nextPlanId: () => string;
  nextPlanOptionIds: (count: number) => string[];
  now: () => Date;
  persistPlanPoll: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

type PlanApiExports = typeof api & {
  POST_CONVERSATION_PLAN_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handlePostConversationPlan?: (
    context: PlanMutationContext,
    params: { conversationId: string },
    body: {
      format: "quartet" | "social_pod";
      timeOptions: Array<{ startsAt: string; endsAt: string }>;
      venueOptions?: Array<{ venueId?: string; manualLabel?: string }>;
    },
    dependencies: PlanRouteDependencies
  ) => Promise<Record<string, unknown>>;
};

const planApi = api as PlanApiExports;
const member: AuthenticatedMember = {
  memberId: "member_a"
};

describe("conversation Plan API route", () => {
  it("publishes documented conversation Plan route metadata", () => {
    expect(planApi.POST_CONVERSATION_PLAN_ROUTE).toEqual({
      method: "POST",
      path: "/v1/conversations/{conversationId}/plans",
      auth: "Conversation participant",
      requiresIdempotencyKey: true
    });
  });

  it("persists a plan poll with its outbox event from an active group conversation", async () => {
    expect(planApi.handlePostConversationPlan).toBeTypeOf("function");

    const calls: string[] = [];
    const persistPlanPoll = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("persist-plan-with-outbox");

      return input.plan as Record<string, unknown>;
    });

    const result = await planApi.handlePostConversationPlan?.(
      { member, idempotencyKey: "idem-plan" },
      { conversationId: "conversation_1" },
      {
        format: "quartet",
        timeOptions: [{ startsAt: "2026-06-22T09:00:00.000Z", endsAt: "2026-06-22T11:00:00.000Z" }],
        venueOptions: [{ manualLabel: "Harbour Bar" }]
      },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        loadConversationPlanAccess: vi.fn(async () => {
          calls.push("access");

          return {
            conversationStatus: "active" as const,
            groupIds: ["group_1", "group_2"],
            cityId: "city_1"
          };
        }),
        assertGroupsEligibleForPlan: vi.fn(async () => {
          calls.push("eligibility");
        }),
        nextPlanId: () => "plan_1",
        nextPlanOptionIds: () => ["option_time_1", "option_venue_1"],
        now: () => new Date("2026-06-20T10:00:00.000Z"),
        persistPlanPoll
      }
    );

    expect(calls).toEqual(["idempotency", "access", "eligibility", "persist-plan-with-outbox"]);
    expect(result).toMatchObject({
      id: "plan_1",
      status: "polling",
      conversationId: "conversation_1",
      groupIds: ["group_1", "group_2"],
      options: [
        { id: "option_time_1", optionType: "time" },
        { id: "option_venue_1", optionType: "venue" }
      ]
    });
    expect(persistPlanPoll).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxEvent: {
          aggregateType: "plan",
          aggregateId: "plan_1",
          eventName: "plan.poll_created",
          eventVersion: 1,
          payload: {
            planId: "plan_1",
            conversationId: "conversation_1",
            optionIds: ["option_time_1", "option_venue_1"]
          }
        }
      })
    );
  });

  it("requires idempotency before creating plan polls", async () => {
    await expect(
      planApi.handlePostConversationPlan?.(
        { member, idempotencyKey: null },
        { conversationId: "conversation_1" },
        {
          format: "quartet",
          timeOptions: [{ startsAt: "2026-06-22T09:00:00.000Z", endsAt: "2026-06-22T11:00:00.000Z" }]
        },
        {
          reserveIdempotencyKey: vi.fn(),
          loadConversationPlanAccess: vi.fn(),
          assertGroupsEligibleForPlan: vi.fn(),
          nextPlanId: () => "plan_1",
          nextPlanOptionIds: () => ["option_time_1"],
          now: () => new Date("2026-06-20T10:00:00.000Z"),
          persistPlanPoll: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
