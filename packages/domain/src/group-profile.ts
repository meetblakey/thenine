import { DomainInvariantError } from "./group-eligibility.js";
import type { ModerationStatus } from "./types.js";

export interface GroupVouchMembership {
  memberId: string;
  membershipStatus: "active" | "left" | "removed" | "paused";
}

export interface GroupVouch {
  id: string;
  groupId: string;
  authorMemberId: string;
  subjectMemberId: string;
  body: string;
  subjectApprovedAt: string | null;
  moderationStatus: ModerationStatus;
  hiddenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupVouchModerationDecision {
  status: ModerationStatus;
  reasonCode: string | null;
}

export type GroupVouchEventDraft =
  | {
      aggregateType: "group";
      aggregateId: string;
      eventName: "group.vouch_created";
      eventVersion: 1;
      payload: {
        groupId: string;
        vouchId: string;
        authorMemberId: string;
        subjectMemberId: string;
        moderationStatus: "approved";
        subjectApprovedAt: string | null;
        hiddenAt: string | null;
      };
    }
  | {
      aggregateType: "group";
      aggregateId: string;
      eventName: "group.vouch_held";
      eventVersion: 1;
      payload: {
        groupId: string;
        vouchId: string;
        authorMemberId: string;
        subjectMemberId: string;
        moderationStatus: Exclude<ModerationStatus, "approved" | "not_required">;
        reasonCode: string | null;
      };
    }
  | {
      aggregateType: "group";
      aggregateId: string;
      eventName: "group.vouch_updated";
      eventVersion: 1;
      payload: {
        groupId: string;
        vouchId: string;
        authorMemberId: string;
        subjectMemberId: string;
        moderationStatus: ModerationStatus;
        subjectApprovedAt: string | null;
        hiddenAt: string | null;
      };
    };

export interface GroupVouchWriteResult {
  vouch: GroupVouch;
  outboxEvent: GroupVouchEventDraft;
}

export function createGroupVouch(input: {
  vouchId: string;
  groupId: string;
  authorMemberId: string;
  subjectMemberId: string;
  body: string;
  groupMembers: GroupVouchMembership[];
  moderation: GroupVouchModerationDecision;
  createdAt: string;
}): GroupVouchWriteResult {
  assertDistinctFriendVouch(input.authorMemberId, input.subjectMemberId);
  assertActiveGroupMember(input.groupMembers, input.authorMemberId);
  assertActiveGroupMember(input.groupMembers, input.subjectMemberId);

  const body = normalizeVouchBody(input.body);
  const vouch: GroupVouch = {
    id: input.vouchId,
    groupId: input.groupId,
    authorMemberId: input.authorMemberId,
    subjectMemberId: input.subjectMemberId,
    body,
    subjectApprovedAt: null,
    moderationStatus: input.moderation.status,
    hiddenAt: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  };

  return {
    vouch,
    outboxEvent: createVouchEvent(vouch, "created", input.moderation.reasonCode)
  };
}

export function updateGroupVouch(input: {
  vouch: GroupVouch;
  actorMemberId: string;
  groupMembers: GroupVouchMembership[];
  body?: string;
  subjectApproved?: boolean;
  hidden?: boolean;
  moderation?: GroupVouchModerationDecision;
  updatedAt: string;
}): GroupVouchWriteResult {
  assertActiveGroupMember(input.groupMembers, input.actorMemberId);

  let vouch = input.vouch;

  if (input.body !== undefined) {
    if (input.actorMemberId !== vouch.authorMemberId) {
      throw new DomainInvariantError("FORBIDDEN", "Only the vouch author can edit vouch copy.");
    }

    if (input.moderation === undefined) {
      throw new DomainInvariantError("VALIDATION_ERROR", "Edited vouch copy requires a moderation decision.");
    }

    vouch = {
      ...vouch,
      body: normalizeVouchBody(input.body),
      subjectApprovedAt: null,
      moderationStatus: input.moderation.status,
      hiddenAt: null,
      updatedAt: input.updatedAt
    };
  }

  if (input.subjectApproved !== undefined) {
    assertSubjectActor(input.actorMemberId, vouch.subjectMemberId);

    if (input.subjectApproved && vouch.moderationStatus !== "approved") {
      throw new DomainInvariantError("MESSAGE_MODERATION_HELD", "Vouch copy must pass moderation before subject approval.");
    }

    vouch = {
      ...vouch,
      subjectApprovedAt: input.subjectApproved ? input.updatedAt : null,
      updatedAt: input.updatedAt
    };
  }

  if (input.hidden !== undefined) {
    assertSubjectActor(input.actorMemberId, vouch.subjectMemberId);

    vouch = {
      ...vouch,
      hiddenAt: input.hidden ? input.updatedAt : null,
      updatedAt: input.updatedAt
    };
  }

  if (vouch === input.vouch) {
    throw new DomainInvariantError("VALIDATION_ERROR", "Vouch updates require body, subjectApproved, or hidden.");
  }

  return {
    vouch,
    outboxEvent: createVouchEvent(vouch, "updated", input.moderation?.reasonCode ?? null)
  };
}

function normalizeVouchBody(body: string): string {
  const normalizedBody = body.trim();

  if (normalizedBody === "") {
    throw new DomainInvariantError("VALIDATION_ERROR", "Vouch body is required.");
  }

  return normalizedBody;
}

function assertDistinctFriendVouch(authorMemberId: string, subjectMemberId: string): void {
  if (authorMemberId === subjectMemberId) {
    throw new DomainInvariantError("UNPROCESSABLE_STATE", "Vouch blurbs must describe a friend in the Group, not the author.");
  }
}

function assertActiveGroupMember(groupMembers: GroupVouchMembership[], memberId: string): void {
  const activeMember = groupMembers.find((member) => member.memberId === memberId && member.membershipStatus === "active");

  if (activeMember === undefined) {
    throw new DomainInvariantError("GROUP_ACCESS_DENIED", "Vouch blurbs require active Group members.");
  }
}

function assertSubjectActor(actorMemberId: string, subjectMemberId: string): void {
  if (actorMemberId !== subjectMemberId) {
    throw new DomainInvariantError("FORBIDDEN", "Only the vouched subject can approve or hide the vouch.");
  }
}

function createVouchEvent(vouch: GroupVouch, action: "created" | "updated", reasonCode: string | null): GroupVouchEventDraft {
  if (vouch.moderationStatus !== "approved" && vouch.moderationStatus !== "not_required") {
    return {
      aggregateType: "group",
      aggregateId: vouch.groupId,
      eventName: "group.vouch_held",
      eventVersion: 1,
      payload: {
        groupId: vouch.groupId,
        vouchId: vouch.id,
        authorMemberId: vouch.authorMemberId,
        subjectMemberId: vouch.subjectMemberId,
        moderationStatus: vouch.moderationStatus,
        reasonCode
      }
    };
  }

  if (action === "created") {
    return {
      aggregateType: "group",
      aggregateId: vouch.groupId,
      eventName: "group.vouch_created",
      eventVersion: 1,
      payload: {
        groupId: vouch.groupId,
        vouchId: vouch.id,
        authorMemberId: vouch.authorMemberId,
        subjectMemberId: vouch.subjectMemberId,
        moderationStatus: "approved",
        subjectApprovedAt: vouch.subjectApprovedAt,
        hiddenAt: vouch.hiddenAt
      }
    };
  }

  return {
    aggregateType: "group",
    aggregateId: vouch.groupId,
    eventName: "group.vouch_updated",
    eventVersion: 1,
    payload: {
      groupId: vouch.groupId,
      vouchId: vouch.id,
      authorMemberId: vouch.authorMemberId,
      subjectMemberId: vouch.subjectMemberId,
      moderationStatus: vouch.moderationStatus,
      subjectApprovedAt: vouch.subjectApprovedAt,
      hiddenAt: vouch.hiddenAt
    }
  };
}
