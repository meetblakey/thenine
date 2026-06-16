import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";

interface AuthenticatedMember {
  memberId: string;
}

interface IntroductionContext {
  member: AuthenticatedMember | null;
}

interface IntroductionMutationContext extends IntroductionContext {
  idempotencyKey: string | null;
}

type ApprovalState = "pending_internal" | "sent" | "matched" | "declined";

interface IntroductionRecordFixture {
  id: string;
  recipientGroupId: string;
  kind: "quartet_group";
  targetGroupId: string | null;
  targetPlanId: string | null;
  rankPosition: number;
  score: number;
  compatibilityScore?: number;
  reasonCodes: string[];
  expiresAt: string;
}

interface IntroductionRouteDependencies {
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  loadGroupEligibility: (groupId: string) => Promise<{ groupId: string; status: "eligible" | "ineligible"; blockers: string[] }>;
  loadDailyIntroductionSet: (input: {
    recipientGroupId: string;
    date?: string;
    format?: "quartet" | "social_pod";
  }) => Promise<{
    setId: string;
    baselineSize: number;
    entitlementExtraSize: number;
    liquidityMode: string;
    introductions: Array<Record<string, unknown>>;
  }>;
}

interface IntroductionDetailDependencies {
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  loadIntroductionForGroup: (input: { groupId: string; introductionId: string }) => Promise<IntroductionRecordFixture>;
}

interface IntroductionApprovalDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  loadGroupEligibility: (groupId: string) => Promise<{ groupId: string; status: "eligible" | "ineligible"; blockers: string[] }>;
  reviewIntroductionInterestApproval: (input: {
    groupId: string;
    introductionId: string;
    memberId: string;
    approve: boolean;
  }) => Promise<{
    introduction: IntroductionRecordFixture;
    approvalState: ApprovalState;
    sourceGroupId: string;
    targetGroupId: string | null;
  }>;
  nextConversationId: () => string;
  loadConversationParticipantGroups: (
    groupIds: string[]
  ) => Promise<Array<{ groupId: string; memberIds: string[] }>>;
  persistMatchedGroupConversation: (input: Record<string, unknown>) => Promise<void>;
}

interface IntroductionPassDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  recordIntroductionPass: (input: { groupId: string; introductionId: string; memberId: string; reasonCode?: string }) => Promise<{
    introductionId: string;
    status: "passed";
  }>;
}

type IntroductionApiExports = typeof api & {
  GET_DAILY_INTRODUCTIONS_ROUTE?: { method: string; path: string; auth: string };
  GET_INTRODUCTION_ROUTE?: { method: string; path: string; auth: string };
  POST_INTRODUCTION_APPROVAL_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  POST_INTRODUCTION_PASS_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handleGetDailyIntroductions?: (
    context: IntroductionContext,
    params: { groupId: string },
    query: { date?: string; format?: "quartet" | "social_pod"; memberId?: string },
    dependencies: IntroductionRouteDependencies
  ) => Promise<Record<string, unknown>>;
  handleGetIntroduction?: (
    context: IntroductionContext,
    params: { groupId: string; introductionId: string },
    dependencies: IntroductionDetailDependencies
  ) => Promise<Record<string, unknown>>;
  handlePostIntroductionApproval?: (
    context: IntroductionMutationContext,
    params: { groupId: string; introductionId: string },
    body: { approve: boolean },
    dependencies: IntroductionApprovalDependencies
  ) => Promise<Record<string, unknown>>;
  handlePostIntroductionPass?: (
    context: IntroductionMutationContext,
    params: { groupId: string; introductionId: string },
    body: { reasonCode?: string },
    dependencies: IntroductionPassDependencies
  ) => Promise<Record<string, unknown>>;
};

const introductionApi = api as IntroductionApiExports;

const introductionRecord = (): IntroductionRecordFixture => ({
  id: "intro_1",
  recipientGroupId: "group_1",
  kind: "quartet_group",
  targetGroupId: "group_2",
  targetPlanId: null,
  rankPosition: 1,
  score: 0.91,
  compatibilityScore: 0.88,
  reasonCodes: ["shared_availability"],
  expiresAt: "2026-06-21T00:00:00.000Z"
});

describe("daily Introduction API route", () => {
  it("publishes group-scoped daily Introduction route metadata", () => {
    expect(introductionApi.GET_DAILY_INTRODUCTIONS_ROUTE).toEqual({
      method: "GET",
      path: "/v1/groups/{groupId}/introductions/daily",
      auth: "Group member"
    });
    expect(introductionApi.GET_INTRODUCTION_ROUTE).toEqual({
      method: "GET",
      path: "/v1/groups/{groupId}/introductions/{introductionId}",
      auth: "Group member"
    });
    expect(introductionApi.POST_INTRODUCTION_APPROVAL_ROUTE).toEqual({
      method: "POST",
      path: "/v1/groups/{groupId}/introductions/{introductionId}/interest-approvals",
      auth: "Group member",
      requiresIdempotencyKey: true
    });
    expect(introductionApi.POST_INTRODUCTION_PASS_ROUTE).toEqual({
      method: "POST",
      path: "/v1/groups/{groupId}/introductions/{introductionId}/pass",
      auth: "Group member",
      requiresIdempotencyKey: true
    });
  });

  it("returns serialized Introductions without ranking-only scores", async () => {
    expect(introductionApi.handleGetDailyIntroductions).toBeTypeOf("function");

    const result = await introductionApi.handleGetDailyIntroductions?.(
      { member: { memberId: "member_1" } },
      { groupId: "group_1" },
      { date: "2026-06-20", format: "quartet" },
      {
        assertGroupMemberAccess: vi.fn(async () => undefined),
        loadGroupEligibility: vi.fn(async () => ({ groupId: "group_1", status: "eligible" as const, blockers: [] })),
        loadDailyIntroductionSet: vi.fn(async () => ({
          setId: "set_1",
          baselineSize: 3,
          entitlementExtraSize: 0,
          liquidityMode: "normal",
          introductions: [
            {
              id: "intro_1",
              recipientGroupId: "group_1",
              kind: "quartet_group",
              targetGroupId: "group_2",
              targetPlanId: null,
              rankPosition: 1,
              score: 0.91,
              compatibilityScore: 0.88,
              reasonCodes: ["shared_availability"],
              expiresAt: "2026-06-21T00:00:00.000Z"
            }
          ]
        }))
      }
    );

    expect(result).toMatchObject({
      setId: "set_1",
      baselineSize: 3,
      introductions: [
        {
          id: "intro_1",
          recipientGroupId: "group_1",
          targetGroupId: "group_2",
          rankPosition: 1,
          reasonCodes: ["shared_availability"]
        }
      ]
    });
    expect(JSON.stringify(result)).not.toContain("compatibilityScore");
    expect(JSON.stringify(result)).not.toContain("score");
  });

  it("rejects member-scoped dating inventory attempts", async () => {
    await expect(
      introductionApi.handleGetDailyIntroductions?.(
        { member: { memberId: "member_1" } },
        { groupId: "group_1" },
        { memberId: "member_1" },
        {
          assertGroupMemberAccess: vi.fn(),
          loadGroupEligibility: vi.fn(),
          loadDailyIntroductionSet: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("returns one Introduction only through group access and without ranking-only scores", async () => {
    expect(introductionApi.handleGetIntroduction).toBeTypeOf("function");

    const loadIntroductionForGroup = vi.fn(async () => introductionRecord());
    const result = await introductionApi.handleGetIntroduction?.(
      { member: { memberId: "member_1" } },
      { groupId: "group_1", introductionId: "intro_1" },
      {
        assertGroupMemberAccess: vi.fn(async () => undefined),
        loadIntroductionForGroup
      }
    );

    expect(loadIntroductionForGroup).toHaveBeenCalledWith({ groupId: "group_1", introductionId: "intro_1" });
    expect(result).toMatchObject({
      id: "intro_1",
      recipientGroupId: "group_1",
      targetGroupId: "group_2",
      reasonCodes: ["shared_availability"]
    });
    expect(JSON.stringify(result)).not.toContain("compatibilityScore");
    expect(JSON.stringify(result)).not.toContain("score");
  });

  it("records internal approval with idempotency before creating a matched group chat", async () => {
    expect(introductionApi.handlePostIntroductionApproval).toBeTypeOf("function");

    const calls: string[] = [];
    const persistMatchedGroupConversation = vi.fn(async () => {
      calls.push("persist-conversation-with-outbox");
    });
    const result = await introductionApi.handlePostIntroductionApproval?.(
      { member: { memberId: "member_2" }, idempotencyKey: "idem-approval" },
      { groupId: "group_1", introductionId: "intro_1" },
      { approve: true },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        assertGroupMemberAccess: vi.fn(async () => {
          calls.push("access");
        }),
        loadGroupEligibility: vi.fn(async () => {
          calls.push("eligibility");

          return { groupId: "group_1", status: "eligible" as const, blockers: [] };
        }),
        reviewIntroductionInterestApproval: vi.fn(async () => {
          calls.push("review-approval");

          return {
            introduction: introductionRecord(),
            approvalState: "matched" as const,
            sourceGroupId: "group_1",
            targetGroupId: "group_2"
          };
        }),
        nextConversationId: () => "conversation_1",
        loadConversationParticipantGroups: vi.fn(async () => {
          calls.push("load-participants");

          return [
            { groupId: "group_1", memberIds: ["member_a", "member_b"] },
            { groupId: "group_2", memberIds: ["member_c", "member_d"] }
          ];
        }),
        persistMatchedGroupConversation
      }
    );

    expect(calls).toEqual(["idempotency", "access", "eligibility", "review-approval", "load-participants", "persist-conversation-with-outbox"]);
    expect(result).toMatchObject({
      approvalState: "matched",
      introduction: {
        id: "intro_1",
        recipientGroupId: "group_1",
        targetGroupId: "group_2"
      }
    });
    expect(persistMatchedGroupConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: expect.objectContaining({
          id: "conversation_1",
          kind: "group_chat",
          groupIds: ["group_1", "group_2"],
          sourceIntroductionId: "intro_1"
        }),
        outboxEvent: expect.objectContaining({ eventName: "introduction.mutual_match_created" })
      })
    );
    expect(JSON.stringify(result)).not.toContain("compatibilityScore");
    expect(JSON.stringify(result)).not.toContain("score");
  });

  it("records passes silently through a group-scoped idempotent mutation", async () => {
    expect(introductionApi.handlePostIntroductionPass).toBeTypeOf("function");

    const reserveIdempotencyKey = vi.fn(async () => undefined);
    const recordIntroductionPass = vi.fn(async () => ({ introductionId: "intro_1", status: "passed" as const }));
    const result = await introductionApi.handlePostIntroductionPass?.(
      { member: { memberId: "member_1" }, idempotencyKey: "idem-pass" },
      { groupId: "group_1", introductionId: "intro_1" },
      { reasonCode: "not_the_right_fit" },
      {
        reserveIdempotencyKey,
        assertGroupMemberAccess: vi.fn(async () => undefined),
        recordIntroductionPass
      }
    );

    expect(reserveIdempotencyKey).toHaveBeenCalledWith(
      "POST /v1/groups/{groupId}/introductions/{introductionId}/pass",
      "idem-pass",
      "member_1"
    );
    expect(recordIntroductionPass).toHaveBeenCalledWith({
      groupId: "group_1",
      introductionId: "intro_1",
      memberId: "member_1",
      reasonCode: "not_the_right_fit"
    });
    expect(result).toEqual({ introductionId: "intro_1", status: "passed" });
  });
});
