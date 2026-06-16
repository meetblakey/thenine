import { DomainInvariantError } from "./group-eligibility.js";
import { assertSafetyActionsWithinOneTap, createGroupConversation } from "./invariants.js";
import type { ConversationResource, ConversationStatus, MessageResource, ModerationStatus, SafetyAction } from "./types.js";

export interface MatchedGroupParticipantInput {
  groupId: string;
  memberIds: string[];
}

export interface MatchedGroupConversationInput {
  conversationId: string;
  sourceIntroductionId: string;
  sourceGroupId: string;
  targetGroupId: string;
  participantGroups: MatchedGroupParticipantInput[];
}

export interface MatchedGroupConversationResource extends Omit<ConversationResource, "kind" | "status"> {
  kind: "group_chat";
  status: "active";
  sourceIntroductionId: string;
  lastMessageAt: null;
}

export interface MutualMatchCreatedEventDraft {
  aggregateType: "introduction";
  aggregateId: string;
  eventName: "introduction.mutual_match_created";
  eventVersion: 1;
  payload: {
    introductionId: string;
    conversationId: string;
    groupIds: string[];
  };
}

export interface MatchedGroupConversationResult {
  conversation: MatchedGroupConversationResource;
  outboxEvent: MutualMatchCreatedEventDraft;
  safetySurface: {
    surface: "group_chat";
    active: true;
    actions: SafetyAction[];
  };
}

export interface ConversationMessageAccess {
  conversationStatus: ConversationStatus;
  canWrite: boolean;
}

export interface ConversationMessageModerationDecision {
  status: ModerationStatus;
  reasonCode: string | null;
}

export interface ConversationMessageWriteInput {
  messageId: string;
  conversationId: string;
  senderMemberId: string;
  senderGroupId: string;
  clientNonce: string;
  body?: string;
  mediaAssetIds?: string[];
  sequenceNumber: number;
  createdAt: string;
  access: ConversationMessageAccess;
  moderation: ConversationMessageModerationDecision;
}

export type ConversationMessageEventDraft =
  | {
      aggregateType: "conversation";
      aggregateId: string;
      eventName: "conversation.message_created";
      eventVersion: 1;
      payload: {
        message: MessageResource;
      };
    }
  | {
      aggregateType: "conversation";
      aggregateId: string;
      eventName: "conversation.message_held";
      eventVersion: 1;
      payload: {
        conversationId: string;
        clientNonce: string;
        moderationStatus: "held_for_review";
        reasonCode: string | null;
      };
    };

export interface ConversationMessageWriteResult {
  message: MessageResource;
  outboxEvent: ConversationMessageEventDraft;
}

const groupChatSafetyActions: SafetyAction[] = ["report", "block", "leave", "urgent_help", "share_plan"];

export function buildMatchedGroupConversation(input: MatchedGroupConversationInput): MatchedGroupConversationResult {
  if (input.sourceGroupId === input.targetGroupId) {
    throw new DomainInvariantError("UNPROCESSABLE_STATE", "Matched group chats require two distinct Groups.");
  }

  const groupIds = [input.sourceGroupId, input.targetGroupId];
  const participantGroupsById = new Map(input.participantGroups.map((participantGroup) => [participantGroup.groupId, participantGroup]));

  for (const groupId of groupIds) {
    const participantGroup = participantGroupsById.get(groupId);

    if (participantGroup === undefined || participantGroup.memberIds.length === 0) {
      throw new DomainInvariantError(
        "UNPROCESSABLE_STATE",
        "Matched group conversations require active participant members for both Groups."
      );
    }
  }

  const participantMemberIds = groupIds.flatMap((groupId) => participantGroupsById.get(groupId)?.memberIds ?? []);
  const baseConversation = createGroupConversation({
    conversationId: input.conversationId,
    groupIds,
    participantMemberIds
  });
  const safetySurface = {
    surface: "group_chat",
    active: true,
    actions: groupChatSafetyActions
  } satisfies MatchedGroupConversationResult["safetySurface"];

  assertSafetyActionsWithinOneTap(safetySurface);

  return {
    conversation: {
      id: baseConversation.id,
      kind: "group_chat",
      status: "active",
      groupIds: baseConversation.groupIds,
      sourceIntroductionId: input.sourceIntroductionId,
      parentConversationId: null,
      participantMemberIds: baseConversation.participantMemberIds,
      lastMessageAt: null
    },
    outboxEvent: {
      aggregateType: "introduction",
      aggregateId: input.sourceIntroductionId,
      eventName: "introduction.mutual_match_created",
      eventVersion: 1,
      payload: {
        introductionId: input.sourceIntroductionId,
        conversationId: input.conversationId,
        groupIds
      }
    },
    safetySurface
  };
}

export function buildConversationMessageWrite(input: ConversationMessageWriteInput): ConversationMessageWriteResult {
  if (input.access.conversationStatus !== "active") {
    throw new DomainInvariantError("CONVERSATION_CLOSED", "Conversation is closed for message writes.");
  }

  if (!input.access.canWrite) {
    throw new DomainInvariantError("FORBIDDEN", "Conversation participant cannot write messages.");
  }

  if (input.clientNonce.trim() === "") {
    throw new DomainInvariantError("VALIDATION_ERROR", "Conversation messages require clientNonce.");
  }

  const body = input.body === undefined || input.body.trim() === "" ? null : input.body;
  const mediaAssetIds = input.mediaAssetIds ?? [];

  if (body === null && mediaAssetIds.length === 0) {
    throw new DomainInvariantError("VALIDATION_ERROR", "Conversation messages require body or approved media.");
  }

  if (input.moderation.status !== "approved" && input.moderation.status !== "held_for_review") {
    throw new DomainInvariantError("MESSAGE_MODERATION_HELD", "Conversation message is not approved for broadcast.");
  }

  const message: MessageResource = {
    id: input.messageId,
    conversationId: input.conversationId,
    senderMemberId: input.senderMemberId,
    senderGroupId: input.senderGroupId,
    body,
    mediaAssetIds,
    moderationStatus: input.moderation.status,
    sequenceNumber: input.sequenceNumber,
    createdAt: input.createdAt
  };

  if (input.moderation.status === "held_for_review") {
    return {
      message,
      outboxEvent: {
        aggregateType: "conversation",
        aggregateId: input.conversationId,
        eventName: "conversation.message_held",
        eventVersion: 1,
        payload: {
          conversationId: input.conversationId,
          clientNonce: input.clientNonce,
          moderationStatus: "held_for_review",
          reasonCode: input.moderation.reasonCode
        }
      }
    };
  }

  return {
    message,
    outboxEvent: {
      aggregateType: "conversation",
      aggregateId: input.conversationId,
      eventName: "conversation.message_created",
      eventVersion: 1,
      payload: {
        message
      }
    }
  };
}
