import { describe, expect, it } from "vitest";
import * as domain from "./index.js";
import type { ModerationStatus } from "./types.js";

interface GroupVouchMembership {
  memberId: string;
  membershipStatus: "active" | "left" | "removed" | "paused";
}

interface GroupVouch {
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

type GroupVouchWriteResult = {
  vouch: GroupVouch;
  outboxEvent: {
    aggregateType: "group";
    aggregateId: string;
    eventName: "group.vouch_created" | "group.vouch_held" | "group.vouch_updated";
    eventVersion: 1;
    payload: Record<string, unknown>;
  };
};

type GroupProfileDomainExports = typeof domain & {
  createGroupVouch?: (input: {
    vouchId: string;
    groupId: string;
    authorMemberId: string;
    subjectMemberId: string;
    body: string;
    groupMembers: GroupVouchMembership[];
    moderation: { status: ModerationStatus; reasonCode: string | null };
    createdAt: string;
  }) => GroupVouchWriteResult;
  updateGroupVouch?: (input: {
    vouch: GroupVouch;
    actorMemberId: string;
    groupMembers: GroupVouchMembership[];
    body?: string;
    subjectApproved?: boolean;
    hidden?: boolean;
    moderation?: { status: ModerationStatus; reasonCode: string | null };
    updatedAt: string;
  }) => GroupVouchWriteResult;
};

const groupProfileDomain = domain as GroupProfileDomainExports;

const activeGroupMembers: GroupVouchMembership[] = [
  { memberId: "member_1", membershipStatus: "active" },
  { memberId: "member_2", membershipStatus: "active" }
];

const approvedVouch: GroupVouch = {
  id: "vouch_1",
  groupId: "group_1",
  authorMemberId: "member_1",
  subjectMemberId: "member_2",
  body: "Ari is calm, direct, and looks out for everyone.",
  subjectApprovedAt: null,
  moderationStatus: "approved",
  hiddenAt: null,
  createdAt: "2026-06-20T10:00:00.000Z",
  updatedAt: "2026-06-20T10:00:00.000Z"
};

describe("group profile vouch domain", () => {
  it("creates a moderated friend vouch that waits for subject consent before publication", () => {
    expect(groupProfileDomain.createGroupVouch).toBeTypeOf("function");

    const result = groupProfileDomain.createGroupVouch?.({
      vouchId: "vouch_1",
      groupId: "group_1",
      authorMemberId: "member_1",
      subjectMemberId: "member_2",
      body: "Ari is calm, direct, and looks out for everyone.",
      groupMembers: activeGroupMembers,
      moderation: { status: "approved", reasonCode: null },
      createdAt: "2026-06-20T10:00:00.000Z"
    });

    expect(result?.vouch).toEqual(approvedVouch);
    expect(result?.outboxEvent).toEqual({
      aggregateType: "group",
      aggregateId: "group_1",
      eventName: "group.vouch_created",
      eventVersion: 1,
      payload: {
        groupId: "group_1",
        vouchId: "vouch_1",
        authorMemberId: "member_1",
        subjectMemberId: "member_2",
        moderationStatus: "approved",
        subjectApprovedAt: null,
        hiddenAt: null
      }
    });
    expect(JSON.stringify(result?.outboxEvent.payload)).not.toContain("calm, direct");
  });

  it("holds risky vouch copy without broadcasting the private body", () => {
    expect(groupProfileDomain.createGroupVouch).toBeTypeOf("function");

    const result = groupProfileDomain.createGroupVouch?.({
      vouchId: "vouch_held",
      groupId: "group_1",
      authorMemberId: "member_1",
      subjectMemberId: "member_2",
      body: "unsafe private detail",
      groupMembers: activeGroupMembers,
      moderation: { status: "held_for_review", reasonCode: "private_information" },
      createdAt: "2026-06-20T10:05:00.000Z"
    });

    expect(result?.vouch).toMatchObject({
      id: "vouch_held",
      moderationStatus: "held_for_review",
      subjectApprovedAt: null,
      hiddenAt: null
    });
    expect(result?.outboxEvent).toEqual({
      aggregateType: "group",
      aggregateId: "group_1",
      eventName: "group.vouch_held",
      eventVersion: 1,
      payload: {
        groupId: "group_1",
        vouchId: "vouch_held",
        authorMemberId: "member_1",
        subjectMemberId: "member_2",
        moderationStatus: "held_for_review",
        reasonCode: "private_information"
      }
    });
    expect(JSON.stringify(result?.outboxEvent.payload)).not.toContain("unsafe private detail");
  });

  it("lets only the vouched subject approve or hide the vouch", () => {
    expect(groupProfileDomain.updateGroupVouch).toBeTypeOf("function");

    const approved = groupProfileDomain.updateGroupVouch?.({
      vouch: approvedVouch,
      actorMemberId: "member_2",
      groupMembers: activeGroupMembers,
      subjectApproved: true,
      updatedAt: "2026-06-20T10:10:00.000Z"
    });

    expect(approved?.vouch).toMatchObject({
      id: "vouch_1",
      subjectApprovedAt: "2026-06-20T10:10:00.000Z",
      hiddenAt: null
    });

    const hidden = groupProfileDomain.updateGroupVouch?.({
      vouch: approved?.vouch ?? approvedVouch,
      actorMemberId: "member_2",
      groupMembers: activeGroupMembers,
      hidden: true,
      updatedAt: "2026-06-20T10:11:00.000Z"
    });

    expect(hidden?.vouch).toMatchObject({
      id: "vouch_1",
      subjectApprovedAt: "2026-06-20T10:10:00.000Z",
      hiddenAt: "2026-06-20T10:11:00.000Z"
    });

    expect(() =>
      groupProfileDomain.updateGroupVouch?.({
        vouch: approvedVouch,
        actorMemberId: "member_1",
        groupMembers: activeGroupMembers,
        subjectApproved: true,
        updatedAt: "2026-06-20T10:12:00.000Z"
      })
    ).toThrow(/subject/i);
  });

  it("resets subject approval when the author edits copy for another moderation pass", () => {
    expect(groupProfileDomain.updateGroupVouch).toBeTypeOf("function");

    const result = groupProfileDomain.updateGroupVouch?.({
      vouch: { ...approvedVouch, subjectApprovedAt: "2026-06-20T10:10:00.000Z" },
      actorMemberId: "member_1",
      groupMembers: activeGroupMembers,
      body: "Ari keeps plans grounded and kind.",
      moderation: { status: "approved", reasonCode: null },
      updatedAt: "2026-06-20T10:20:00.000Z"
    });

    expect(result?.vouch).toMatchObject({
      body: "Ari keeps plans grounded and kind.",
      subjectApprovedAt: null,
      moderationStatus: "approved",
      hiddenAt: null,
      updatedAt: "2026-06-20T10:20:00.000Z"
    });
  });

  it("rejects self-vouches and vouches for non-active group members", () => {
    expect(groupProfileDomain.createGroupVouch).toBeTypeOf("function");

    expect(() =>
      groupProfileDomain.createGroupVouch?.({
        vouchId: "vouch_self",
        groupId: "group_1",
        authorMemberId: "member_1",
        subjectMemberId: "member_1",
        body: "I am great",
        groupMembers: activeGroupMembers,
        moderation: { status: "approved", reasonCode: null },
        createdAt: "2026-06-20T10:30:00.000Z"
      })
    ).toThrow(/friend/i);

    expect(() =>
      groupProfileDomain.createGroupVouch?.({
        vouchId: "vouch_outsider",
        groupId: "group_1",
        authorMemberId: "member_1",
        subjectMemberId: "member_3",
        body: "Kai is great",
        groupMembers: activeGroupMembers,
        moderation: { status: "approved", reasonCode: null },
        createdAt: "2026-06-20T10:31:00.000Z"
      })
    ).toThrow(/active group/i);
  });
});
