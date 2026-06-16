import { describe, expect, it } from "vitest";
import * as domain from "./index.js";
import type { ModerationStatus } from "./types.js";

interface ConversationMessageInput {
  messageId: string;
  conversationId: string;
  senderMemberId: string;
  senderGroupId: string;
  clientNonce: string;
  body?: string;
  mediaAssetIds?: string[];
  sequenceNumber: number;
  createdAt: string;
  access: {
    conversationStatus: "active" | "write_limited" | "expired" | "closed";
    canWrite: boolean;
  };
  moderation: {
    status: ModerationStatus;
    reasonCode: string | null;
  };
}

type ConversationMessageResult = {
  message: {
    id: string;
    conversationId: string;
    senderMemberId: string;
    senderGroupId: string;
    body: string | null;
    mediaAssetIds: string[];
    moderationStatus: ModerationStatus;
    sequenceNumber: number;
    createdAt: string;
  };
  outboxEvent: {
    aggregateType: "conversation";
    aggregateId: string;
    eventName: "conversation.message_created" | "conversation.message_held";
    eventVersion: 1;
    payload: Record<string, unknown>;
  };
};

type ConversationDomainExports = typeof domain & {
  buildConversationMessageWrite?: (input: ConversationMessageInput) => ConversationMessageResult;
};

const conversationDomain = domain as ConversationDomainExports;

const activeAccess = {
  conversationStatus: "active" as const,
  canWrite: true
};

describe("conversation message domain", () => {
  it("drafts an approved group-chat message with a conversation outbox event", () => {
    expect(conversationDomain.buildConversationMessageWrite).toBeTypeOf("function");

    const result = conversationDomain.buildConversationMessageWrite?.({
      messageId: "message_1",
      conversationId: "conversation_1",
      senderMemberId: "member_a",
      senderGroupId: "group_1",
      clientNonce: "nonce_1",
      body: "Can everyone do Friday?",
      mediaAssetIds: ["asset_1"],
      sequenceNumber: 7,
      createdAt: "2026-06-20T10:00:00.000Z",
      access: activeAccess,
      moderation: { status: "approved", reasonCode: null }
    });

    expect(result?.message).toEqual({
      id: "message_1",
      conversationId: "conversation_1",
      senderMemberId: "member_a",
      senderGroupId: "group_1",
      body: "Can everyone do Friday?",
      mediaAssetIds: ["asset_1"],
      moderationStatus: "approved",
      sequenceNumber: 7,
      createdAt: "2026-06-20T10:00:00.000Z"
    });
    expect(result?.outboxEvent).toEqual({
      aggregateType: "conversation",
      aggregateId: "conversation_1",
      eventName: "conversation.message_created",
      eventVersion: 1,
      payload: {
        message: result?.message
      }
    });
  });

  it("keeps held message content out of broadcast payloads", () => {
    expect(conversationDomain.buildConversationMessageWrite).toBeTypeOf("function");

    const result = conversationDomain.buildConversationMessageWrite?.({
      messageId: "message_2",
      conversationId: "conversation_1",
      senderMemberId: "member_a",
      senderGroupId: "group_1",
      clientNonce: "nonce_held",
      body: "unsafe text",
      sequenceNumber: 8,
      createdAt: "2026-06-20T10:01:00.000Z",
      access: activeAccess,
      moderation: { status: "held_for_review", reasonCode: "harassment" }
    });

    expect(result?.message).toMatchObject({
      id: "message_2",
      moderationStatus: "held_for_review",
      body: "unsafe text"
    });
    expect(result?.outboxEvent).toEqual({
      aggregateType: "conversation",
      aggregateId: "conversation_1",
      eventName: "conversation.message_held",
      eventVersion: 1,
      payload: {
        conversationId: "conversation_1",
        clientNonce: "nonce_held",
        moderationStatus: "held_for_review",
        reasonCode: "harassment"
      }
    });
    expect(JSON.stringify(result?.outboxEvent.payload)).not.toContain("unsafe text");
  });

  it("rejects writes to closed conversations or non-writable participants", () => {
    expect(conversationDomain.buildConversationMessageWrite).toBeTypeOf("function");

    expect(() =>
      conversationDomain.buildConversationMessageWrite?.({
        messageId: "message_3",
        conversationId: "conversation_1",
        senderMemberId: "member_a",
        senderGroupId: "group_1",
        clientNonce: "nonce_3",
        body: "Hello",
        sequenceNumber: 9,
        createdAt: "2026-06-20T10:02:00.000Z",
        access: { conversationStatus: "closed", canWrite: true },
        moderation: { status: "approved", reasonCode: null }
      })
    ).toThrow(/closed/i);

    expect(() =>
      conversationDomain.buildConversationMessageWrite?.({
        messageId: "message_4",
        conversationId: "conversation_1",
        senderMemberId: "member_a",
        senderGroupId: "group_1",
        clientNonce: "nonce_4",
        body: "Hello",
        sequenceNumber: 10,
        createdAt: "2026-06-20T10:03:00.000Z",
        access: { conversationStatus: "active", canWrite: false },
        moderation: { status: "approved", reasonCode: null }
      })
    ).toThrow(/participant/i);
  });
});
