import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";

interface AuthenticatedMember {
  memberId: string;
}

interface IntroductionMutationContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

type ApprovalState = "pending_internal" | "sent" | "matched";

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

interface IntroductionInterestDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  loadGroupEligibility: (groupId: string) => Promise<{ groupId: string; status: "eligible" | "ineligible"; blockers: string[] }>;
  recordGroupInterest: (input: {
    groupId: string;
    introductionId: string;
    memberId: string;
    clientNonce: string;
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

type IntroductionApiExports = typeof api & {
  POST_INTRODUCTION_INTEREST_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handlePostIntroductionInterest?: (
    context: IntroductionMutationContext,
    params: { groupId: string; introductionId: string },
    body: { clientNonce: string },
    dependencies: IntroductionInterestDependencies
  ) => Promise<Record<string, unknown>>;
};

const introductionApi = api as IntroductionApiExports;

const member: AuthenticatedMember = {
  memberId: "member_1"
};

const matchedIntroduction = (): IntroductionRecordFixture => ({
  id: "introduction_1",
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

describe("Introduction interest API route", () => {
  it("publishes documented group-scoped interest route metadata", () => {
    expect(introductionApi.POST_INTRODUCTION_INTEREST_ROUTE).toEqual({
      method: "POST",
      path: "/v1/groups/{groupId}/introductions/{introductionId}/interest",
      auth: "Group member",
      requiresIdempotencyKey: true
    });
  });

  it("creates the group chat through persisted state plus outbox when group interest matches", async () => {
    expect(introductionApi.handlePostIntroductionInterest).toBeTypeOf("function");

    const calls: string[] = [];
    const persistMatchedGroupConversation = vi.fn(async () => {
      calls.push("persist-conversation-with-outbox");
    });

    const result = await introductionApi.handlePostIntroductionInterest?.(
      { member, idempotencyKey: "idem-interest" },
      { groupId: "group_1", introductionId: "introduction_1" },
      { clientNonce: "nonce_1" },
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
        recordGroupInterest: vi.fn(async () => {
          calls.push("record-interest");

          return {
            introduction: matchedIntroduction(),
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

    expect(calls).toEqual(["idempotency", "access", "eligibility", "record-interest", "load-participants", "persist-conversation-with-outbox"]);
    expect(result).toMatchObject({
      approvalState: "matched",
      introduction: {
        id: "introduction_1",
        recipientGroupId: "group_1",
        targetGroupId: "group_2",
        reasonCodes: ["shared_availability"]
      }
    });
    expect(JSON.stringify(result)).not.toContain("compatibilityScore");
    expect(JSON.stringify(result)).not.toContain("score");
    expect(persistMatchedGroupConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: expect.objectContaining({
          id: "conversation_1",
          kind: "group_chat",
          groupIds: ["group_1", "group_2"],
          sourceIntroductionId: "introduction_1",
          participantMemberIds: ["member_a", "member_b", "member_c", "member_d"]
        }),
        outboxEvent: expect.objectContaining({
          eventName: "introduction.mutual_match_created",
          aggregateType: "introduction",
          aggregateId: "introduction_1",
          payload: {
            introductionId: "introduction_1",
            conversationId: "conversation_1",
            groupIds: ["group_1", "group_2"]
          }
        })
      })
    );
  });

  it("requires idempotency before recording interest", async () => {
    await expect(
      introductionApi.handlePostIntroductionInterest?.(
        { member, idempotencyKey: null },
        { groupId: "group_1", introductionId: "introduction_1" },
        { clientNonce: "nonce_1" },
        {
          reserveIdempotencyKey: vi.fn(),
          assertGroupMemberAccess: vi.fn(),
          loadGroupEligibility: vi.fn(),
          recordGroupInterest: vi.fn(),
          nextConversationId: () => "conversation_1",
          loadConversationParticipantGroups: vi.fn(),
          persistMatchedGroupConversation: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
