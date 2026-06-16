import { describe, expect, it } from "vitest";
import {
  DomainInvariantError,
  acceptGroupInvite,
  approveGroupPublication,
  createGroupDraft,
  createGroupInvite
} from "./group-formation.js";

const approvedMember = (memberId: string) => ({
  memberId,
  memberStatus: "active" as const,
  verificationStatus: "approved" as const
});

describe("group formation domain service", () => {
  it("lets a verified active member create a quartet group shell without making it eligible", () => {
    const group = createGroupDraft({
      groupId: "group_1",
      cityId: "city_1",
      format: "quartet",
      creator: approvedMember("member_1"),
      name: "Sunday Table",
      intent: "serious"
    });

    expect(group).toMatchObject({
      id: "group_1",
      cityId: "city_1",
      format: "quartet",
      status: "pending_member",
      createdByMemberId: "member_1",
      memberships: [
        {
          memberId: "member_1",
          role: "creator",
          status: "active",
          verificationStatus: "approved"
        }
      ]
    });
  });

  it("blocks group creation until the acting member is verified", () => {
    expect(() =>
      createGroupDraft({
        groupId: "group_1",
        cityId: "city_1",
        format: "quartet",
        creator: {
          memberId: "member_1",
          memberStatus: "active",
          verificationStatus: "pending"
        }
      })
    ).toThrow(new DomainInvariantError("VERIFICATION_REQUIRED", "Members must be verified before creating or joining Groups."));
  });

  it("creates hashed invite records without raw recipient contact fields", () => {
    const group = createGroupDraft({
      groupId: "group_1",
      cityId: "city_1",
      format: "quartet",
      creator: approvedMember("member_1")
    });

    const invite = createGroupInvite({
      inviteId: "invite_1",
      group,
      inviterMemberId: "member_1",
      tokenHash: "sha256:token",
      recipientHintHash: "sha256:phone",
      expiresAt: "2026-06-18T00:00:00.000Z"
    });

    expect(invite).toEqual({
      id: "invite_1",
      groupId: "group_1",
      inviterMemberId: "member_1",
      tokenHash: "sha256:token",
      recipientHintHash: "sha256:phone",
      status: "pending",
      expiresAt: "2026-06-18T00:00:00.000Z",
      acceptedByMemberId: null,
      acceptedAt: null,
      revokedAt: null
    });
    expect(Object.keys(invite)).not.toEqual(expect.arrayContaining(["recipientHint", "phone", "email"]));
  });

  it("rejects invite creation by non-active group memberships", () => {
    const group = {
      ...createGroupDraft({
        groupId: "group_1",
        cityId: "city_1",
        format: "quartet",
        creator: approvedMember("member_1")
      }),
      memberships: [
        {
          memberId: "member_1",
          role: "creator" as const,
          status: "active" as const,
          verificationStatus: "approved" as const,
          publishApprovedAt: null
        },
        {
          memberId: "member_2",
          role: "member" as const,
          status: "invited" as const,
          verificationStatus: "approved" as const,
          publishApprovedAt: null
        }
      ]
    };

    expect(() =>
      createGroupInvite({
        inviteId: "invite_1",
        group,
        inviterMemberId: "member_2",
        tokenHash: "sha256:token",
        expiresAt: "2026-06-18T00:00:00.000Z"
      })
    ).toThrow(expect.objectContaining({ code: "GROUP_ACCESS_DENIED" }));
  });

  it("accepts a valid quartet invite for a verified member and moves the group to publish approval", () => {
    const group = createGroupDraft({
      groupId: "group_1",
      cityId: "city_1",
      format: "quartet",
      creator: approvedMember("member_1")
    });
    const invite = createGroupInvite({
      inviteId: "invite_1",
      group,
      inviterMemberId: "member_1",
      tokenHash: "sha256:token",
      expiresAt: "2026-06-18T00:00:00.000Z"
    });

    const result = acceptGroupInvite({
      group,
      invite,
      invitee: approvedMember("member_2"),
      acceptedAt: "2026-06-16T12:00:00.000Z"
    });

    expect(result.group.status).toBe("pending_publish_approval");
    expect(result.group.memberships.map((membership) => membership.memberId)).toEqual(["member_1", "member_2"]);
    expect(result.invite).toMatchObject({
      status: "accepted",
      acceptedByMemberId: "member_2",
      acceptedAt: "2026-06-16T12:00:00.000Z"
    });
  });

  it("rejects expired invites and unverified invitees", () => {
    const group = createGroupDraft({
      groupId: "group_1",
      cityId: "city_1",
      format: "quartet",
      creator: approvedMember("member_1")
    });
    const invite = createGroupInvite({
      inviteId: "invite_1",
      group,
      inviterMemberId: "member_1",
      tokenHash: "sha256:token",
      expiresAt: "2026-06-15T00:00:00.000Z"
    });

    expect(() =>
      acceptGroupInvite({
        group,
        invite,
        invitee: approvedMember("member_2"),
        acceptedAt: "2026-06-16T12:00:00.000Z"
      })
    ).toThrow(new DomainInvariantError("INVITE_NOT_ACCEPTABLE", "Invite must be pending and unexpired before it can be accepted."));

    const pendingInvite = createGroupInvite({
      inviteId: "invite_2",
      group,
      inviterMemberId: "member_1",
      tokenHash: "sha256:token-2",
      expiresAt: "2026-06-18T00:00:00.000Z"
    });

    expect(() =>
      acceptGroupInvite({
        group,
        invite: pendingInvite,
        invitee: {
          memberId: "member_2",
          memberStatus: "active",
          verificationStatus: "pending"
        },
        acceptedAt: "2026-06-16T12:00:00.000Z"
      })
    ).toThrow(new DomainInvariantError("VERIFICATION_REQUIRED", "Members must be verified before creating or joining Groups."));
  });

  it("records member publish approval and publishes only after every active member approves the same preview", () => {
    const group = {
      ...createGroupDraft({
        groupId: "group_1",
        cityId: "city_1",
        format: "quartet",
        creator: approvedMember("member_1"),
        name: "Sunday Table",
        intent: "serious"
      }),
      status: "pending_publish_approval" as const,
      memberships: [
        {
          memberId: "member_1",
          role: "creator" as const,
          status: "active" as const,
          verificationStatus: "approved" as const,
          publishApprovedAt: null
        },
        {
          memberId: "member_2",
          role: "member" as const,
          status: "active" as const,
          verificationStatus: "approved" as const,
          publishApprovedAt: null
        }
      ]
    };

    const firstApproval = approveGroupPublication({
      group,
      memberId: "member_1",
      approve: true,
      visibilityPreviewHash: "preview_hash_1",
      currentVisibilityPreviewHash: "preview_hash_1",
      approvedAt: "2026-06-16T10:00:00.000Z"
    });

    expect(firstApproval).toMatchObject({
      group: {
        id: "group_1",
        status: "pending_publish_approval",
        memberships: [
          { memberId: "member_1", publishApprovedAt: "2026-06-16T10:00:00.000Z" },
          { memberId: "member_2", publishApprovedAt: null }
        ]
      },
      allApproved: false,
      outboxEvent: {
        eventName: "group.publish_approval_changed",
        payload: {
          groupId: "group_1",
          memberId: "member_1",
          approved: true,
          allApproved: false
        }
      }
    });

    const secondApproval = approveGroupPublication({
      group: firstApproval.group,
      memberId: "member_2",
      approve: true,
      visibilityPreviewHash: "preview_hash_1",
      currentVisibilityPreviewHash: "preview_hash_1",
      approvedAt: "2026-06-16T10:05:00.000Z"
    });

    expect(secondApproval).toMatchObject({
      group: {
        status: "eligible",
        publishApprovedAt: "2026-06-16T10:05:00.000Z",
        visibilityPreviewHash: "preview_hash_1"
      },
      allApproved: true,
      outboxEvent: {
        aggregateType: "group",
        aggregateId: "group_1",
        eventName: "group.publish_approval_changed",
        eventVersion: 1,
        payload: {
          groupId: "group_1",
          memberId: "member_2",
          approved: true,
          allApproved: true
        }
      }
    });
  });

  it("rejects publish approval when the approved preview hash is stale", () => {
    const group = {
      ...createGroupDraft({
        groupId: "group_1",
        cityId: "city_1",
        format: "quartet",
        creator: approvedMember("member_1"),
        name: "Sunday Table",
        intent: "serious"
      }),
      status: "pending_publish_approval" as const
    };

    expect(() =>
      approveGroupPublication({
        group,
        memberId: "member_1",
        approve: true,
        visibilityPreviewHash: "old_preview_hash",
        currentVisibilityPreviewHash: "new_preview_hash",
        approvedAt: "2026-06-16T10:00:00.000Z"
      })
    ).toThrow(new DomainInvariantError("CONFLICT", "Publish approval must match the current visibility preview."));
  });
});
