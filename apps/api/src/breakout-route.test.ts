import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";

interface AuthenticatedMember {
  memberId: string;
}

interface BreakoutMutationContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

type ConversationStatus = "active" | "write_limited" | "expired" | "closed";
type BreakoutReason = "message_threshold" | "confirmed_plan" | "mutual_edge";
type BreakoutResponse = "accept" | "decline";

interface BreakoutRecipientCandidate {
  memberId: string;
  groupId: string;
}

interface BreakoutRequestAccess {
  conversationStatus: ConversationStatus;
  requesterGroupId: string;
  eligibleRecipients: BreakoutRecipientCandidate[];
}

interface BreakoutRequestRecord {
  id: string;
  parentConversationId: string;
  requesterMemberId: string;
  recipientMemberId: string;
  requesterGroupId: string;
  recipientGroupId: string;
  status: "pending" | "accepted" | "declined" | "expired" | "blocked";
  eligibilityReason: BreakoutReason;
  createdConversationId: string | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
}

interface BreakoutConversationResource {
  id: string;
  kind: "breakout";
  status: "active";
  groupIds: string[];
  parentConversationId: string;
  participantMemberIds: string[];
}

interface BreakoutRequestDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadBreakoutRequestAccess: (conversationId: string, requesterMemberId: string) => Promise<BreakoutRequestAccess>;
  nextBreakoutRequestId: () => string;
  now: () => Date;
  breakoutRequestExpiresAt: (createdAt: Date) => Date;
  persistBreakoutRequest: (input: Record<string, unknown>) => Promise<{ requestId: string; status: "pending"; expiresAt: string }>;
}

interface BreakoutRespondDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadBreakoutRequestForRecipient: (requestId: string, recipientMemberId: string) => Promise<BreakoutRequestRecord>;
  nextConversationId: () => string;
  now: () => Date;
  persistBreakoutResponse: (input: Record<string, unknown>) => Promise<{
    requestId: string;
    status: "accepted" | "declined";
    conversationId: string | null;
  }>;
}

type ConversationApiExports = typeof api & {
  POST_BREAKOUT_REQUEST_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  POST_BREAKOUT_RESPOND_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handlePostBreakoutRequest?: (
    context: BreakoutMutationContext,
    params: { conversationId: string },
    body: { recipientMemberId: string; reason: BreakoutReason },
    dependencies: BreakoutRequestDependencies
  ) => Promise<{ requestId: string; status: "pending"; expiresAt: string }>;
  handlePostBreakoutRespond?: (
    context: BreakoutMutationContext,
    params: { requestId: string },
    body: { response: BreakoutResponse },
    dependencies: BreakoutRespondDependencies
  ) => Promise<{ requestId: string; status: "accepted" | "declined"; conversationId: string | null }>;
};

const conversationApi = api as ConversationApiExports;
const requester: AuthenticatedMember = { memberId: "member_a" };
const recipient: AuthenticatedMember = { memberId: "member_c" };

const pendingRequest = (): BreakoutRequestRecord => ({
  id: "breakout_request_1",
  parentConversationId: "conversation_1",
  requesterMemberId: "member_a",
  recipientMemberId: "member_c",
  requesterGroupId: "group_1",
  recipientGroupId: "group_2",
  status: "pending",
  eligibilityReason: "message_threshold",
  createdConversationId: null,
  expiresAt: "2026-06-21T10:00:00.000Z",
  createdAt: "2026-06-20T10:00:00.000Z",
  respondedAt: null
});

describe("breakout API routes", () => {
  it("publishes documented breakout route metadata", () => {
    expect(conversationApi.POST_BREAKOUT_REQUEST_ROUTE).toEqual({
      method: "POST",
      path: "/v1/conversations/{conversationId}/breakout-requests",
      auth: "Conversation participant",
      requiresIdempotencyKey: true
    });
    expect(conversationApi.POST_BREAKOUT_RESPOND_ROUTE).toEqual({
      method: "POST",
      path: "/v1/breakout-requests/{requestId}/respond",
      auth: "Request recipient",
      requiresIdempotencyKey: true
    });
  });

  it("persists a recipient-private breakout request after idempotency and eligibility checks", async () => {
    expect(conversationApi.handlePostBreakoutRequest).toBeTypeOf("function");

    const calls: string[] = [];
    const persistBreakoutRequest = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("save-request");
      const request = input.request as BreakoutRequestRecord;

      return { requestId: request.id, status: "pending" as const, expiresAt: request.expiresAt };
    });

    const result = await conversationApi.handlePostBreakoutRequest?.(
      { member: requester, idempotencyKey: "idem-breakout-request" },
      { conversationId: "conversation_1" },
      { recipientMemberId: "member_c", reason: "message_threshold" },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        loadBreakoutRequestAccess: vi.fn(async () => {
          calls.push("access");

          return {
            conversationStatus: "active" as const,
            requesterGroupId: "group_1",
            eligibleRecipients: [{ memberId: "member_c", groupId: "group_2" }]
          };
        }),
        nextBreakoutRequestId: () => "breakout_request_1",
        now: () => new Date("2026-06-20T10:00:00.000Z"),
        breakoutRequestExpiresAt: () => new Date("2026-06-21T10:00:00.000Z"),
        persistBreakoutRequest
      }
    );

    expect(calls).toEqual(["idempotency", "access", "save-request"]);
    expect(result).toEqual({
      requestId: "breakout_request_1",
      status: "pending",
      expiresAt: "2026-06-21T10:00:00.000Z"
    });
    expect(persistBreakoutRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        request: {
          id: "breakout_request_1",
          parentConversationId: "conversation_1",
          requesterMemberId: "member_a",
          recipientMemberId: "member_c",
          requesterGroupId: "group_1",
          recipientGroupId: "group_2",
          status: "pending",
          eligibilityReason: "message_threshold",
          createdConversationId: null,
          expiresAt: "2026-06-21T10:00:00.000Z",
          createdAt: "2026-06-20T10:00:00.000Z",
          respondedAt: null
        },
        outboxEvent: {
          aggregateType: "conversation",
          aggregateId: "conversation_1",
          eventName: "breakout.requested",
          eventVersion: 1,
          payload: {
            requestId: "breakout_request_1",
            parentConversationId: "conversation_1",
            requesterMemberId: "member_a",
            expiresAt: "2026-06-21T10:00:00.000Z"
          }
        }
      })
    );
    expect(JSON.stringify((persistBreakoutRequest.mock.calls[0]?.[0] as { outboxEvent?: { payload?: unknown } }).outboxEvent?.payload)).not.toMatch(
      /member_b|member_d|group_1|group_2/
    );
  });

  it("accepts a breakout request into a consent-gated child conversation", async () => {
    expect(conversationApi.handlePostBreakoutRespond).toBeTypeOf("function");

    const calls: string[] = [];
    const persistBreakoutResponse = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("save-response");
      const request = input.request as BreakoutRequestRecord;
      const conversation = input.conversation as BreakoutConversationResource;

      return { requestId: request.id, status: "accepted" as const, conversationId: conversation.id };
    });

    const result = await conversationApi.handlePostBreakoutRespond?.(
      { member: recipient, idempotencyKey: "idem-breakout-accept" },
      { requestId: "breakout_request_1" },
      { response: "accept" },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        loadBreakoutRequestForRecipient: vi.fn(async () => {
          calls.push("request-access");

          return pendingRequest();
        }),
        nextConversationId: () => "conversation_breakout_1",
        now: () => new Date("2026-06-20T10:05:00.000Z"),
        persistBreakoutResponse
      }
    );

    expect(calls).toEqual(["idempotency", "request-access", "save-response"]);
    expect(result).toEqual({
      requestId: "breakout_request_1",
      status: "accepted",
      conversationId: "conversation_breakout_1"
    });
    expect(persistBreakoutResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          id: "breakout_request_1",
          status: "accepted",
          createdConversationId: "conversation_breakout_1",
          respondedAt: "2026-06-20T10:05:00.000Z"
        }),
        conversation: {
          id: "conversation_breakout_1",
          kind: "breakout",
          status: "active",
          groupIds: ["group_1", "group_2"],
          parentConversationId: "conversation_1",
          participantMemberIds: ["member_a", "member_c"]
        },
        outboxEvents: [
          {
            aggregateType: "conversation",
            aggregateId: "conversation_1",
            eventName: "breakout.responded",
            eventVersion: 1,
            payload: {
              requestId: "breakout_request_1",
              status: "accepted",
              conversationId: "conversation_breakout_1"
            }
          },
          {
            aggregateType: "conversation",
            aggregateId: "conversation_breakout_1",
            eventName: "breakout.opened",
            eventVersion: 1,
            payload: {
              conversationId: "conversation_breakout_1",
              parentConversationId: "conversation_1",
              participantMemberIds: ["member_a", "member_c"]
            }
          }
        ]
      })
    );
  });

  it("declines a breakout request privately without creating a child conversation", async () => {
    expect(conversationApi.handlePostBreakoutRespond).toBeTypeOf("function");

    const persistBreakoutResponse = vi.fn(async (input: Record<string, unknown>) => {
      const request = input.request as BreakoutRequestRecord;

      return { requestId: request.id, status: "declined" as const, conversationId: null };
    });

    const result = await conversationApi.handlePostBreakoutRespond?.(
      { member: recipient, idempotencyKey: "idem-breakout-decline" },
      { requestId: "breakout_request_1" },
      { response: "decline" },
      {
        reserveIdempotencyKey: vi.fn(async () => undefined),
        loadBreakoutRequestForRecipient: vi.fn(async () => pendingRequest()),
        nextConversationId: () => "conversation_breakout_1",
        now: () => new Date("2026-06-20T10:05:00.000Z"),
        persistBreakoutResponse
      }
    );

    expect(result).toEqual({
      requestId: "breakout_request_1",
      status: "declined",
      conversationId: null
    });
    expect(persistBreakoutResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          status: "declined",
          createdConversationId: null,
          respondedAt: "2026-06-20T10:05:00.000Z"
        }),
        conversation: null,
        outboxEvents: [
          {
            aggregateType: "conversation",
            aggregateId: "conversation_1",
            eventName: "breakout.responded",
            eventVersion: 1,
            payload: {
              requestId: "breakout_request_1",
              status: "declined",
              conversationId: null
            }
          }
        ]
      })
    );
    expect(JSON.stringify((persistBreakoutResponse.mock.calls[0]?.[0] as { outboxEvents?: Array<{ eventName: string }> }).outboxEvents)).not.toContain(
      "breakout.opened"
    );
  });

  it("requires idempotency before loading breakout state", async () => {
    const loadBreakoutRequestAccess = vi.fn();
    const loadBreakoutRequestForRecipient = vi.fn();

    await expect(
      conversationApi.handlePostBreakoutRequest?.(
        { member: requester, idempotencyKey: null },
        { conversationId: "conversation_1" },
        { recipientMemberId: "member_c", reason: "message_threshold" },
        {
          reserveIdempotencyKey: vi.fn(),
          loadBreakoutRequestAccess,
          nextBreakoutRequestId: () => "breakout_request_1",
          now: () => new Date("2026-06-20T10:00:00.000Z"),
          breakoutRequestExpiresAt: () => new Date("2026-06-21T10:00:00.000Z"),
          persistBreakoutRequest: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await expect(
      conversationApi.handlePostBreakoutRespond?.(
        { member: recipient, idempotencyKey: null },
        { requestId: "breakout_request_1" },
        { response: "accept" },
        {
          reserveIdempotencyKey: vi.fn(),
          loadBreakoutRequestForRecipient,
          nextConversationId: () => "conversation_breakout_1",
          now: () => new Date("2026-06-20T10:05:00.000Z"),
          persistBreakoutResponse: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(loadBreakoutRequestAccess).not.toHaveBeenCalled();
    expect(loadBreakoutRequestForRecipient).not.toHaveBeenCalled();
  });
});
