import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";

interface AuthenticatedMember {
  memberId: string;
}

interface ConversationMutationContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

interface ConversationMessageDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadConversationParticipantAccess: (
    conversationId: string,
    memberId: string
  ) => Promise<{ conversationStatus: "active" | "write_limited" | "expired" | "closed"; canWrite: boolean; senderGroupId: string }>;
  assertMediaAssetsApproved: (mediaAssetIds: string[], memberId: string, conversationId: string) => Promise<void>;
  moderateMessage: (input: {
    conversationId: string;
    senderMemberId: string;
    senderGroupId: string;
    body: string | null;
    mediaAssetIds: string[];
  }) => Promise<{ status: "approved" | "held_for_review"; reasonCode: string | null }>;
  nextMessageId: () => string;
  nextMessageSequenceNumber: (conversationId: string) => Promise<number>;
  now: () => Date;
  persistConversationMessage: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

type ConversationApiExports = typeof api & {
  POST_CONVERSATION_MESSAGE_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handlePostConversationMessage?: (
    context: ConversationMutationContext,
    params: { conversationId: string },
    body: { clientNonce: string; body?: string; mediaAssetIds?: string[] },
    dependencies: ConversationMessageDependencies
  ) => Promise<Record<string, unknown>>;
};

const conversationApi = api as ConversationApiExports;
const member: AuthenticatedMember = {
  memberId: "member_a"
};

const activeAccess = {
  conversationStatus: "active" as const,
  canWrite: true,
  senderGroupId: "group_1"
};

describe("conversation message API route", () => {
  it("publishes documented conversation message route metadata", () => {
    expect(conversationApi.POST_CONVERSATION_MESSAGE_ROUTE).toEqual({
      method: "POST",
      path: "/v1/conversations/{conversationId}/messages",
      auth: "Conversation participant",
      requiresIdempotencyKey: true
    });
  });

  it("persists an approved message with its outbox event before fanout workers run", async () => {
    expect(conversationApi.handlePostConversationMessage).toBeTypeOf("function");

    const calls: string[] = [];
    const persistConversationMessage = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("persist-message-with-outbox");

      return input.message as Record<string, unknown>;
    });

    const result = await conversationApi.handlePostConversationMessage?.(
      { member, idempotencyKey: "idem-message" },
      { conversationId: "conversation_1" },
      { clientNonce: "nonce_1", body: "Can everyone do Friday?", mediaAssetIds: ["asset_1"] },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        loadConversationParticipantAccess: vi.fn(async () => {
          calls.push("access");

          return activeAccess;
        }),
        assertMediaAssetsApproved: vi.fn(async () => {
          calls.push("media");
        }),
        moderateMessage: vi.fn(async () => {
          calls.push("moderation");

          return { status: "approved" as const, reasonCode: null };
        }),
        nextMessageId: () => "message_1",
        nextMessageSequenceNumber: vi.fn(async () => {
          calls.push("sequence");

          return 7;
        }),
        now: () => new Date("2026-06-20T10:00:00.000Z"),
        persistConversationMessage
      }
    );

    expect(calls).toEqual(["idempotency", "access", "media", "moderation", "sequence", "persist-message-with-outbox"]);
    expect(result).toEqual({
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
    expect(persistConversationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxEvent: expect.objectContaining({
          aggregateType: "conversation",
          aggregateId: "conversation_1",
          eventName: "conversation.message_created"
        })
      })
    );
  });

  it("persists held messages with sender-private status and returns the documented hold error", async () => {
    expect(conversationApi.handlePostConversationMessage).toBeTypeOf("function");

    const persistConversationMessage = vi.fn(async (input: Record<string, unknown>) => input.message as Record<string, unknown>);

    await expect(
      conversationApi.handlePostConversationMessage?.(
        { member, idempotencyKey: "idem-held" },
        { conversationId: "conversation_1" },
        { clientNonce: "nonce_held", body: "unsafe text" },
        {
          reserveIdempotencyKey: vi.fn(async () => undefined),
          loadConversationParticipantAccess: vi.fn(async () => activeAccess),
          assertMediaAssetsApproved: vi.fn(async () => undefined),
          moderateMessage: vi.fn(async () => ({ status: "held_for_review" as const, reasonCode: "harassment" })),
          nextMessageId: () => "message_held",
          nextMessageSequenceNumber: vi.fn(async () => 8),
          now: () => new Date("2026-06-20T10:01:00.000Z"),
          persistConversationMessage
        }
      )
    ).rejects.toMatchObject({ code: "MESSAGE_MODERATION_HELD" });

    expect(persistConversationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxEvent: {
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
        }
      })
    );
    expect(JSON.stringify(persistConversationMessage.mock.calls[0]?.[0])).not.toContain("realtime");
    expect(JSON.stringify((persistConversationMessage.mock.calls[0]?.[0] as { outboxEvent?: { payload?: unknown } }).outboxEvent?.payload)).not.toContain(
      "unsafe text"
    );
  });

  it("requires idempotency before creating messages", async () => {
    await expect(
      conversationApi.handlePostConversationMessage?.(
        { member, idempotencyKey: null },
        { conversationId: "conversation_1" },
        { clientNonce: "nonce_1", body: "Hello" },
        {
          reserveIdempotencyKey: vi.fn(),
          loadConversationParticipantAccess: vi.fn(),
          assertMediaAssetsApproved: vi.fn(),
          moderateMessage: vi.fn(),
          nextMessageId: () => "message_1",
          nextMessageSequenceNumber: vi.fn(),
          now: () => new Date("2026-06-20T10:00:00.000Z"),
          persistConversationMessage: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
