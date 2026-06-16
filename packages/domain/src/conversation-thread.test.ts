import { describe, expect, it } from "vitest";
import * as domain from "./index.js";
import type { SafetyAction } from "./types.js";

interface MatchedGroupConversationInput {
  conversationId: string;
  sourceIntroductionId: string;
  sourceGroupId: string;
  targetGroupId: string;
  participantGroups: Array<{ groupId: string; memberIds: string[] }>;
}

interface MatchedGroupConversationResult {
  conversation: {
    id: string;
    kind: "group_chat";
    status: "active";
    groupIds: string[];
    sourceIntroductionId: string;
    parentConversationId: null;
    participantMemberIds: string[];
    lastMessageAt: null;
  };
  outboxEvent: {
    aggregateType: "introduction";
    aggregateId: string;
    eventName: "introduction.mutual_match_created";
    eventVersion: 1;
    payload: {
      introductionId: string;
      conversationId: string;
      groupIds: string[];
    };
  };
  safetySurface: {
    surface: "group_chat";
    active: true;
    actions: SafetyAction[];
  };
}

type ConversationDomainExports = typeof domain & {
  buildMatchedGroupConversation?: (input: MatchedGroupConversationInput) => MatchedGroupConversationResult;
};

const conversationDomain = domain as ConversationDomainExports;

describe("matched group conversation domain", () => {
  it("drafts a group-owned chat and mutual-match outbox event", () => {
    expect(conversationDomain.buildMatchedGroupConversation).toBeTypeOf("function");

    const result = conversationDomain.buildMatchedGroupConversation?.({
      conversationId: "conversation_1",
      sourceIntroductionId: "introduction_1",
      sourceGroupId: "group_1",
      targetGroupId: "group_2",
      participantGroups: [
        { groupId: "group_1", memberIds: ["member_a", "member_b"] },
        { groupId: "group_2", memberIds: ["member_c", "member_d"] }
      ]
    });

    expect(result?.conversation).toEqual({
      id: "conversation_1",
      kind: "group_chat",
      status: "active",
      groupIds: ["group_1", "group_2"],
      sourceIntroductionId: "introduction_1",
      parentConversationId: null,
      participantMemberIds: ["member_a", "member_b", "member_c", "member_d"],
      lastMessageAt: null
    });
    expect(result?.outboxEvent).toEqual({
      aggregateType: "introduction",
      aggregateId: "introduction_1",
      eventName: "introduction.mutual_match_created",
      eventVersion: 1,
      payload: {
        introductionId: "introduction_1",
        conversationId: "conversation_1",
        groupIds: ["group_1", "group_2"]
      }
    });
    expect(() => {
      if (result === undefined) {
        throw new Error("buildMatchedGroupConversation returned no result");
      }

      domain.assertSafetyActionsWithinOneTap(result.safetySurface);
    }).not.toThrow();
  });

  it("rejects member-owned or incomplete dating chats", () => {
    expect(conversationDomain.buildMatchedGroupConversation).toBeTypeOf("function");

    expect(() =>
      conversationDomain.buildMatchedGroupConversation?.({
        conversationId: "conversation_1",
        sourceIntroductionId: "introduction_1",
        sourceGroupId: "group_1",
        targetGroupId: "group_1",
        participantGroups: [{ groupId: "group_1", memberIds: ["member_a", "member_b"] }]
      })
    ).toThrow(/two distinct groups/i);
  });
});
