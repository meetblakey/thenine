import { buildConversationMessageWrite, createBreakoutConversation } from "@thenine/domain";
import { DomainInvariantError } from "@thenine/domain/group-eligibility";
import type {
  BreakoutRequestState,
  ConversationMessageWriteResult,
  ConversationResource,
  ConversationStatus,
  MessageResource,
  ModerationStatus,
  PlanSummaryResource
} from "@thenine/domain";
import { ApiRouteError } from "./launchpad-route.js";
import type { ApiErrorCode } from "./launchpad-route.js";

export const GET_GROUP_CONVERSATIONS_ROUTE = {
  method: "GET",
  path: "/v1/groups/{groupId}/conversations",
  auth: "Group member"
} as const;

export const GET_CONVERSATION_ROUTE = {
  method: "GET",
  path: "/v1/conversations/{conversationId}",
  auth: "Conversation participant"
} as const;

export const POST_CONVERSATION_MESSAGE_ROUTE = {
  method: "POST",
  path: "/v1/conversations/{conversationId}/messages",
  auth: "Conversation participant",
  requiresIdempotencyKey: true
} as const;

export const POST_BREAKOUT_REQUEST_ROUTE = {
  method: "POST",
  path: "/v1/conversations/{conversationId}/breakout-requests",
  auth: "Conversation participant",
  requiresIdempotencyKey: true
} as const;

export const POST_BREAKOUT_RESPOND_ROUTE = {
  method: "POST",
  path: "/v1/breakout-requests/{requestId}/respond",
  auth: "Request recipient",
  requiresIdempotencyKey: true
} as const;

export interface ConversationMutationMember {
  memberId: string;
}

export interface ConversationMutationContext {
  member: ConversationMutationMember | null;
  idempotencyKey: string | null;
}

export interface ConversationParticipantAccess {
  conversationStatus: "active" | "write_limited" | "expired" | "closed";
  canWrite: boolean;
  senderGroupId: string;
}

export interface PostConversationMessageBody {
  clientNonce: string;
  body?: string;
  mediaAssetIds?: string[];
}

export interface ConversationReadResource {
  id: string;
  kind: "group_chat" | "breakout";
  status: ConversationStatus;
  groupIds: string[];
  parentConversationId: string | null;
  participantMemberIds: string[];
  lastMessageAt: string | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface GetGroupConversationsQuery {
  status?: ConversationStatus;
  cursor?: string;
}

export interface GroupConversationsDependencies {
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  loadConversationsForGroup: (input: { groupId: string; status?: ConversationStatus; cursor?: string }) => Promise<Page<ConversationReadResource>>;
}

export interface ConversationDetailDependencies {
  loadConversationForParticipant: (
    conversationId: string,
    memberId: string
  ) => Promise<{ conversation: ConversationReadResource; messages: Page<MessageResource>; plans: PlanSummaryResource[] }>;
}

export interface ConversationMessageModerationInput {
  conversationId: string;
  senderMemberId: string;
  senderGroupId: string;
  body: string | null;
  mediaAssetIds: string[];
}

export interface ConversationMessageDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadConversationParticipantAccess: (conversationId: string, memberId: string) => Promise<ConversationParticipantAccess>;
  assertMediaAssetsApproved: (mediaAssetIds: string[], memberId: string, conversationId: string) => Promise<void>;
  moderateMessage: (input: ConversationMessageModerationInput) => Promise<{ status: Extract<ModerationStatus, "approved" | "held_for_review">; reasonCode: string | null }>;
  nextMessageId: () => string;
  nextMessageSequenceNumber: (conversationId: string) => Promise<number>;
  now: () => Date;
  persistConversationMessage: (input: ConversationMessageWriteResult) => Promise<MessageResource>;
}

export type BreakoutReason = "message_threshold" | "confirmed_plan" | "mutual_edge";
export type BreakoutResponseDecision = "accept" | "decline";

export interface BreakoutRecipientCandidate {
  memberId: string;
  groupId: string;
}

export interface BreakoutRequestAccess {
  conversationStatus: ConversationStatus;
  requesterGroupId: string;
  eligibleRecipients: BreakoutRecipientCandidate[];
}

export interface BreakoutRequestRecord extends BreakoutRequestState {
  eligibilityReason: BreakoutReason;
  createdConversationId: string | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
}

export interface PostBreakoutRequestBody {
  recipientMemberId: string;
  reason: BreakoutReason;
}

export interface PostBreakoutRespondBody {
  response: BreakoutResponseDecision;
}

export interface BreakoutRequestResponse {
  requestId: string;
  status: "pending";
  expiresAt: string;
}

export interface BreakoutRespondResponse {
  requestId: string;
  status: "accepted" | "declined";
  conversationId: string | null;
}

export type BreakoutEventDraft =
  | {
      aggregateType: "conversation";
      aggregateId: string;
      eventName: "breakout.requested";
      eventVersion: 1;
      payload: {
        requestId: string;
        parentConversationId: string;
        requesterMemberId: string;
        expiresAt: string;
      };
    }
  | {
      aggregateType: "conversation";
      aggregateId: string;
      eventName: "breakout.responded";
      eventVersion: 1;
      payload: {
        requestId: string;
        status: "accepted" | "declined";
        conversationId: string | null;
      };
    }
  | {
      aggregateType: "conversation";
      aggregateId: string;
      eventName: "breakout.opened";
      eventVersion: 1;
      payload: {
        conversationId: string;
        parentConversationId: string;
        participantMemberIds: string[];
      };
    };

export interface BreakoutRequestPersistenceInput {
  request: BreakoutRequestRecord;
  outboxEvent: Extract<BreakoutEventDraft, { eventName: "breakout.requested" }>;
}

export interface BreakoutResponsePersistenceInput {
  request: BreakoutRequestRecord;
  conversation: ConversationResource | null;
  outboxEvents: BreakoutEventDraft[];
}

export interface BreakoutRequestDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadBreakoutRequestAccess: (conversationId: string, requesterMemberId: string) => Promise<BreakoutRequestAccess>;
  nextBreakoutRequestId: () => string;
  now: () => Date;
  breakoutRequestExpiresAt: (createdAt: Date) => Date;
  persistBreakoutRequest: (input: BreakoutRequestPersistenceInput) => Promise<BreakoutRequestResponse>;
}

export interface BreakoutRespondDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadBreakoutRequestForRecipient: (requestId: string, recipientMemberId: string) => Promise<BreakoutRequestRecord | null>;
  nextConversationId: () => string;
  now: () => Date;
  persistBreakoutResponse: (input: BreakoutResponsePersistenceInput) => Promise<BreakoutRespondResponse>;
}

export async function handleGetGroupConversations(
  context: ConversationMutationContext,
  params: { groupId: string },
  query: GetGroupConversationsQuery,
  dependencies: GroupConversationsDependencies
): Promise<Page<ConversationReadResource>> {
  const member = requireConversationMember(context.member);
  await dependencies.assertGroupMemberAccess(params.groupId, member.memberId);

  return dependencies.loadConversationsForGroup({
    groupId: params.groupId,
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.cursor === undefined ? {} : { cursor: query.cursor })
  });
}

export async function handleGetConversation(
  context: ConversationMutationContext,
  params: { conversationId: string },
  dependencies: ConversationDetailDependencies
): Promise<{ conversation: ConversationReadResource; messages: Page<MessageResource>; plans: PlanSummaryResource[] }> {
  const member = requireConversationMember(context.member);

  return dependencies.loadConversationForParticipant(params.conversationId, member.memberId);
}

export async function handlePostConversationMessage(
  context: ConversationMutationContext,
  params: { conversationId: string },
  body: PostConversationMessageBody,
  dependencies: ConversationMessageDependencies
): Promise<MessageResource> {
  const member = requireConversationMember(context.member);
  await reserveRequiredConversationIdempotency(
    POST_CONVERSATION_MESSAGE_ROUTE.method,
    POST_CONVERSATION_MESSAGE_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  const mediaAssetIds = body.mediaAssetIds ?? [];
  const messageBody = body.body === undefined || body.body.trim() === "" ? null : body.body;

  if (body.clientNonce.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Conversation messages require clientNonce.");
  }

  if (messageBody === null && mediaAssetIds.length === 0) {
    throw new ApiRouteError("VALIDATION_ERROR", "Conversation messages require body or approved media.");
  }

  const access = await dependencies.loadConversationParticipantAccess(params.conversationId, member.memberId);

  if (mediaAssetIds.length > 0) {
    await dependencies.assertMediaAssetsApproved(mediaAssetIds, member.memberId, params.conversationId);
  }

  const moderation = await dependencies.moderateMessage({
    conversationId: params.conversationId,
    senderMemberId: member.memberId,
    senderGroupId: access.senderGroupId,
    body: messageBody,
    mediaAssetIds
  });
  const sequenceNumber = await dependencies.nextMessageSequenceNumber(params.conversationId);

  try {
    const messageWrite = buildConversationMessageWrite({
      messageId: dependencies.nextMessageId(),
      conversationId: params.conversationId,
      senderMemberId: member.memberId,
      senderGroupId: access.senderGroupId,
      clientNonce: body.clientNonce,
      ...(messageBody === null ? {} : { body: messageBody }),
      mediaAssetIds,
      sequenceNumber,
      createdAt: dependencies.now().toISOString(),
      access,
      moderation
    });
    const persistedMessage = await dependencies.persistConversationMessage(messageWrite);

    if (messageWrite.outboxEvent.eventName === "conversation.message_held") {
      throw new ApiRouteError("MESSAGE_MODERATION_HELD", "Message was held for moderation review.");
    }

    return persistedMessage;
  } catch (error) {
    throw mapConversationDomainError(error);
  }
}

export async function handlePostBreakoutRequest(
  context: ConversationMutationContext,
  params: { conversationId: string },
  body: PostBreakoutRequestBody,
  dependencies: BreakoutRequestDependencies
): Promise<BreakoutRequestResponse> {
  const member = requireConversationMember(context.member);
  await reserveRequiredConversationIdempotency(
    POST_BREAKOUT_REQUEST_ROUTE.method,
    POST_BREAKOUT_REQUEST_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  const recipientMemberId = body.recipientMemberId.trim();

  if (recipientMemberId === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Breakout requests require recipientMemberId.");
  }

  if (recipientMemberId === member.memberId) {
    throw new ApiRouteError("VALIDATION_ERROR", "Breakout requests require a different recipient member.");
  }

  if (!isBreakoutReason(body.reason)) {
    throw new ApiRouteError("VALIDATION_ERROR", "Breakout requests require a documented eligibility reason.");
  }

  const access = await dependencies.loadBreakoutRequestAccess(params.conversationId, member.memberId);

  if (access.conversationStatus !== "active") {
    throw new ApiRouteError("CONVERSATION_CLOSED", "Conversation is closed for Breakout requests.");
  }

  const recipient = access.eligibleRecipients.find((candidate) => candidate.memberId === recipientMemberId);

  if (recipient === undefined) {
    throw new ApiRouteError("BREAKOUT_INELIGIBLE", "Breakout recipient is not eligible from this conversation.");
  }

  const createdAtDate = dependencies.now();
  const createdAt = createdAtDate.toISOString();
  const expiresAt = dependencies.breakoutRequestExpiresAt(createdAtDate).toISOString();
  const request: BreakoutRequestRecord = {
    id: dependencies.nextBreakoutRequestId(),
    parentConversationId: params.conversationId,
    requesterMemberId: member.memberId,
    recipientMemberId,
    requesterGroupId: access.requesterGroupId,
    recipientGroupId: recipient.groupId,
    status: "pending",
    eligibilityReason: body.reason,
    createdConversationId: null,
    expiresAt,
    createdAt,
    respondedAt: null
  };

  return dependencies.persistBreakoutRequest({
    request,
    outboxEvent: {
      aggregateType: "conversation",
      aggregateId: params.conversationId,
      eventName: "breakout.requested",
      eventVersion: 1,
      payload: {
        requestId: request.id,
        parentConversationId: params.conversationId,
        requesterMemberId: member.memberId,
        expiresAt
      }
    }
  });
}

export async function handlePostBreakoutRespond(
  context: ConversationMutationContext,
  params: { requestId: string },
  body: PostBreakoutRespondBody,
  dependencies: BreakoutRespondDependencies
): Promise<BreakoutRespondResponse> {
  const member = requireConversationMember(context.member);
  await reserveRequiredConversationIdempotency(
    POST_BREAKOUT_RESPOND_ROUTE.method,
    POST_BREAKOUT_RESPOND_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  if (body.response !== "accept" && body.response !== "decline") {
    throw new ApiRouteError("VALIDATION_ERROR", "Breakout response must be accept or decline.");
  }

  const request = await dependencies.loadBreakoutRequestForRecipient(params.requestId, member.memberId);

  if (request === null) {
    throw new ApiRouteError("NOT_FOUND", "Breakout request was not found for this recipient.");
  }

  if (request.status !== "pending") {
    throw new ApiRouteError("CONFLICT", "Breakout request has already been resolved.");
  }

  const respondedAt = dependencies.now().toISOString();

  if (body.response === "decline") {
    const declinedRequest: BreakoutRequestRecord = {
      ...request,
      status: "declined",
      createdConversationId: null,
      respondedAt
    };

    return dependencies.persistBreakoutResponse({
      request: declinedRequest,
      conversation: null,
      outboxEvents: [buildBreakoutRespondedEvent(declinedRequest, null)]
    });
  }

  const conversationId = dependencies.nextConversationId();
  const acceptedRequest: BreakoutRequestRecord = {
    ...request,
    status: "accepted",
    createdConversationId: conversationId,
    respondedAt
  };

  try {
    const conversation = createBreakoutConversation({
      conversationId,
      request: acceptedRequest,
      participantMemberIds: [acceptedRequest.requesterMemberId, acceptedRequest.recipientMemberId]
    });

    return await dependencies.persistBreakoutResponse({
      request: acceptedRequest,
      conversation,
      outboxEvents: [
        buildBreakoutRespondedEvent(acceptedRequest, conversationId),
        {
          aggregateType: "conversation",
          aggregateId: conversationId,
          eventName: "breakout.opened",
          eventVersion: 1,
          payload: {
            conversationId,
            parentConversationId: acceptedRequest.parentConversationId,
            participantMemberIds: conversation.participantMemberIds
          }
        }
      ]
    });
  } catch (error) {
    throw mapConversationDomainError(error);
  }
}

function requireConversationMember(member: ConversationMutationMember | null): ConversationMutationMember {
  if (member === null) {
    throw new ApiRouteError("UNAUTHENTICATED", "Conversation routes require a member session.");
  }

  return member;
}

async function reserveRequiredConversationIdempotency(
  method: string,
  path: string,
  context: ConversationMutationContext,
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>
): Promise<void> {
  if (context.idempotencyKey === null || context.idempotencyKey.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Mutating routes require Idempotency-Key.");
  }

  const member = requireConversationMember(context.member);
  await reserveIdempotencyKey(`${method} ${path}`, context.idempotencyKey, member.memberId);
}

function mapConversationDomainError(error: unknown): Error {
  if (error instanceof DomainInvariantError) {
    return new ApiRouteError(error.code as ApiErrorCode, error.message);
  }

  return error instanceof Error ? error : new ApiRouteError("UNPROCESSABLE_STATE", "Unexpected Conversation route failure.");
}

function isBreakoutReason(reason: string): reason is BreakoutReason {
  return reason === "message_threshold" || reason === "confirmed_plan" || reason === "mutual_edge";
}

function buildBreakoutRespondedEvent(
  request: BreakoutRequestRecord,
  conversationId: string | null
): Extract<BreakoutEventDraft, { eventName: "breakout.responded" }> {
  return {
    aggregateType: "conversation",
    aggregateId: request.parentConversationId,
    eventName: "breakout.responded",
    eventVersion: 1,
    payload: {
      requestId: request.id,
      status: request.status === "accepted" ? "accepted" : "declined",
      conversationId
    }
  };
}
