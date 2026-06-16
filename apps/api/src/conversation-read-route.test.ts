import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";

interface AuthenticatedMember {
  memberId: string;
}

interface ConversationContext {
  member: AuthenticatedMember | null;
}

type ConversationStatus = "active" | "write_limited" | "expired" | "closed";

interface ConversationResource {
  id: string;
  kind: "group_chat" | "breakout";
  status: ConversationStatus;
  groupIds: string[];
  parentConversationId: string | null;
  participantMemberIds: string[];
  lastMessageAt: string | null;
}

interface MessageResource {
  id: string;
  conversationId: string;
  senderMemberId: string;
  senderGroupId: string;
  body: string | null;
  mediaAssetIds: string[];
  moderationStatus: "approved" | "held_for_review";
  sequenceNumber: number;
  createdAt: string;
}

interface PlanSummaryResource {
  id: string;
  format: "quartet" | "social_pod";
  status: string;
  startsAt: string | null;
  venueName: string | null;
  groupIds: string[];
}

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

interface GroupConversationsDependencies {
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  loadConversationsForGroup: (input: { groupId: string; status?: ConversationStatus; cursor?: string }) => Promise<Page<ConversationResource>>;
}

interface ConversationDetailDependencies {
  loadConversationForParticipant: (
    conversationId: string,
    memberId: string
  ) => Promise<{ conversation: ConversationResource; messages: Page<MessageResource>; plans: PlanSummaryResource[] }>;
}

type ConversationApiExports = typeof api & {
  GET_GROUP_CONVERSATIONS_ROUTE?: { method: string; path: string; auth: string };
  GET_CONVERSATION_ROUTE?: { method: string; path: string; auth: string };
  handleGetGroupConversations?: (
    context: ConversationContext,
    params: { groupId: string },
    query: { status?: ConversationStatus; cursor?: string },
    dependencies: GroupConversationsDependencies
  ) => Promise<Page<ConversationResource>>;
  handleGetConversation?: (
    context: ConversationContext,
    params: { conversationId: string },
    dependencies: ConversationDetailDependencies
  ) => Promise<{ conversation: ConversationResource; messages: Page<MessageResource>; plans: PlanSummaryResource[] }>;
};

const conversationApi = api as ConversationApiExports;
const member = { memberId: "member_a" };

const groupConversation = (): ConversationResource => ({
  id: "conversation_1",
  kind: "group_chat",
  status: "active",
  groupIds: ["group_1", "group_2"],
  parentConversationId: null,
  participantMemberIds: ["member_a", "member_b", "member_c", "member_d"],
  lastMessageAt: "2026-06-20T10:00:00.000Z"
});

describe("conversation read API routes", () => {
  it("publishes documented group-chat read route metadata", () => {
    expect(conversationApi.GET_GROUP_CONVERSATIONS_ROUTE).toEqual({
      method: "GET",
      path: "/v1/groups/{groupId}/conversations",
      auth: "Group member"
    });
    expect(conversationApi.GET_CONVERSATION_ROUTE).toEqual({
      method: "GET",
      path: "/v1/conversations/{conversationId}",
      auth: "Conversation participant"
    });
  });

  it("lists group-owned conversations only after group access is confirmed", async () => {
    expect(conversationApi.handleGetGroupConversations).toBeTypeOf("function");

    const calls: string[] = [];
    const loadConversationsForGroup = vi.fn(async () => {
      calls.push("load-conversations");

      return { items: [groupConversation()], nextCursor: null };
    });
    const result = await conversationApi.handleGetGroupConversations?.(
      { member },
      { groupId: "group_1" },
      { status: "active", cursor: "cursor_1" },
      {
        assertGroupMemberAccess: vi.fn(async () => {
          calls.push("access");
        }),
        loadConversationsForGroup
      }
    );

    expect(calls).toEqual(["access", "load-conversations"]);
    expect(loadConversationsForGroup).toHaveBeenCalledWith({ groupId: "group_1", status: "active", cursor: "cursor_1" });
    expect(result).toEqual({ items: [groupConversation()], nextCursor: null });
    expect(JSON.stringify(result)).toContain("groupIds");
    expect(JSON.stringify(result)).not.toMatch(/recipientMemberId|memberOwned|swipe|like/i);
  });

  it("returns conversation detail through the participant access loader", async () => {
    expect(conversationApi.handleGetConversation).toBeTypeOf("function");

    const loadConversationForParticipant = vi.fn(async () => ({
      conversation: groupConversation(),
      messages: {
        items: [
          {
            id: "message_1",
            conversationId: "conversation_1",
            senderMemberId: "member_a",
            senderGroupId: "group_1",
            body: "Can everyone do Friday?",
            mediaAssetIds: [],
            moderationStatus: "approved" as const,
            sequenceNumber: 1,
            createdAt: "2026-06-20T10:00:00.000Z"
          }
        ],
        nextCursor: null
      },
      plans: []
    }));

    const result = await conversationApi.handleGetConversation?.(
      { member },
      { conversationId: "conversation_1" },
      { loadConversationForParticipant }
    );

    expect(loadConversationForParticipant).toHaveBeenCalledWith("conversation_1", "member_a");
    expect(result).toMatchObject({
      conversation: { id: "conversation_1", kind: "group_chat", groupIds: ["group_1", "group_2"] },
      messages: { items: [{ id: "message_1", senderGroupId: "group_1" }], nextCursor: null },
      plans: []
    });
  });

  it("rejects unauthenticated conversation reads before loading state", async () => {
    const loadConversationsForGroup = vi.fn();
    const loadConversationForParticipant = vi.fn();

    await expect(
      conversationApi.handleGetGroupConversations?.(
        { member: null },
        { groupId: "group_1" },
        {},
        {
          assertGroupMemberAccess: vi.fn(),
          loadConversationsForGroup
        }
      )
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      conversationApi.handleGetConversation?.(
        { member: null },
        { conversationId: "conversation_1" },
        { loadConversationForParticipant }
      )
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(loadConversationsForGroup).not.toHaveBeenCalled();
    expect(loadConversationForParticipant).not.toHaveBeenCalled();
  });
});
