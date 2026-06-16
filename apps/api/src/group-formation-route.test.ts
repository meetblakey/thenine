import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";

type VerificationStatus = "not_started" | "pending" | "retry_required" | "approved" | "rejected" | "appeal_pending";

interface AuthenticatedMember {
  memberId: string;
  memberStatus: "active" | "suspended" | "banned" | "deleted";
  verificationStatus: VerificationStatus;
}

type ApiExports = typeof api & {
  GET_CURRENT_GROUPS_ROUTE?: { method: string; path: string; auth: string };
  GET_GROUP_ROUTE?: { method: string; path: string; auth: string };
  POST_GROUP_ROUTE?: { method: string; path: string; auth: string; requiresIdempotencyKey: boolean };
  PATCH_GROUP_ROUTE?: { method: string; path: string; auth: string; requiresIdempotencyKey: boolean };
  POST_GROUP_INVITE_ROUTE?: { method: string; path: string; auth: string; requiresIdempotencyKey: boolean };
  POST_GROUP_INVITE_ACCEPT_ROUTE?: { method: string; path: string; auth: string; requiresIdempotencyKey: boolean };
  POST_GROUP_PUBLISH_APPROVAL_ROUTE?: { method: string; path: string; auth: string; requiresIdempotencyKey: boolean };
  POST_GROUP_LEAVE_ROUTE?: { method: string; path: string; auth: string; requiresIdempotencyKey: boolean };
  POST_GROUP_PAUSE_ROUTE?: { method: string; path: string; auth: string; requiresIdempotencyKey: boolean };
  handleGetCurrentGroups?: (context: GroupMutationContext, dependencies: CurrentGroupsDependencies) => Promise<CurrentGroupsResult>;
  handleGetGroup?: (context: GroupMutationContext, params: { groupId: string }, dependencies: GetGroupDependencies) => Promise<GroupResource>;
  handlePostGroup?: (context: GroupMutationContext, body: CreateGroupBody, dependencies: CreateGroupDependencies) => Promise<unknown>;
  handlePatchGroup?: (
    context: GroupMutationContext,
    params: { groupId: string },
    body: PatchGroupBody & Record<string, unknown>,
    dependencies: PatchGroupDependencies
  ) => Promise<GroupDraft>;
  handlePostGroupInvite?: (
    context: GroupMutationContext,
    params: { groupId: string },
    body: CreateInviteBody,
    dependencies: CreateInviteDependencies
  ) => Promise<Record<string, unknown>>;
  handleAcceptGroupInvite?: (
    context: GroupMutationContext,
    params: { token: string },
    body: AcceptInviteBody,
    dependencies: AcceptInviteDependencies
  ) => Promise<Record<string, unknown>>;
  handlePostGroupLeave?: (
    context: GroupMutationContext,
    params: { groupId: string },
    body: LeaveGroupBody,
    dependencies: LeaveGroupDependencies
  ) => Promise<Record<string, unknown>>;
  handlePostGroupPause?: (
    context: GroupMutationContext,
    params: { groupId: string },
    body: PauseGroupBody,
    dependencies: PauseGroupDependencies
  ) => Promise<GroupDraft>;
  handlePostGroupPublishApproval?: (
    context: GroupMutationContext,
    params: { groupId: string },
    body: PublishApprovalBody,
    dependencies: PublishApprovalDependencies
  ) => Promise<GroupDraft>;
};

interface GroupMutationContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

interface CreateGroupBody {
  format: "quartet" | "social_pod";
  cityId: string;
  name?: string;
  intent?: string;
}

interface CreateGroupDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  nextGroupId: () => string;
  saveGroupDraft: (group: unknown) => Promise<unknown>;
}

interface GroupResource {
  id: string;
  cityId: string;
  format: string;
  status: string;
  name: string | null;
  intent: string | null;
  neighborhoodIds: string[];
  availabilityWindows: AvailabilityWindow[];
  eligibilityStatus: "eligible" | "ineligible";
  eligibilityBlockers: string[];
  members: Array<{ memberId: string; role: string; status: string; verificationStatus: string; publishApprovedAt: string | null }>;
}

interface CurrentGroupsResult {
  groups: GroupResource[];
  activeGroupId: string | null;
}

interface CurrentGroupsDependencies {
  loadCurrentGroupsForMember: (memberId: string) => Promise<{ groups: GroupDraft[]; activeGroupId: string | null }>;
}

interface GetGroupDependencies {
  loadGroupForMember: (groupId: string, memberId: string) => Promise<GroupDraft>;
}

interface AvailabilityWindow {
  startsAt: string;
  endsAt: string;
  timezone: string;
}

interface PatchGroupBody {
  name?: string;
  intent?: string;
  neighborhoodIds?: string[];
  availabilityWindows?: AvailabilityWindow[];
}

interface PatchGroupDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadGroupForMember: (groupId: string, memberId: string) => Promise<GroupDraft>;
  computeVisibilityPreviewHash: (input: { group: GroupDraft; patch: PatchGroupBody }) => string;
  now: () => Date;
  saveGroupProfileUpdate: (result: unknown) => Promise<{ group: GroupDraft; outboxEvents: unknown[] }>;
}

interface CreateInviteBody {
  recipientHint?: string;
  expiresInHours: number;
}

interface CreateInviteDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadGroupForMember: (groupId: string, memberId: string) => Promise<GroupDraft>;
  nextInviteId: () => string;
  createInviteToken: () => { tokenHash: string; shareUrl: string };
  hashRecipientHint: (recipientHint: string) => string;
  now: () => Date;
  saveGroupInvite: (invite: unknown) => Promise<unknown>;
}

interface AcceptInviteBody {
  consent: boolean;
}

interface AcceptInviteDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  hashInviteToken: (token: string) => string;
  loadInviteByTokenHash: (tokenHash: string) => Promise<GroupInvite>;
  loadGroupById: (groupId: string) => Promise<GroupDraft>;
  now: () => Date;
  saveAcceptedInvite: (result: unknown) => Promise<unknown>;
}

interface LeaveGroupBody {
  reasonCode?: string;
  safetyExit?: boolean;
}

interface LeaveGroupDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadGroupLeaveContext: (
    groupId: string,
    memberId: string
  ) => Promise<{ group: GroupDraft; affectedPlanIds: string[]; affectedConversationIds: string[] }>;
  now: () => Date;
  saveGroupLeave: (result: unknown) => Promise<{
    group: GroupDraft;
    affectedPlanIds: string[];
    affectedConversationIds: string[];
    outboxEvents: unknown[];
  }>;
}

interface PauseGroupBody {
  reasonCode?: string;
}

interface PauseGroupDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadGroupForMember: (groupId: string, memberId: string) => Promise<GroupDraft>;
  now: () => Date;
  saveGroupPause: (result: unknown) => Promise<{ group: GroupDraft; outboxEvents: unknown[] }>;
}

interface PublishApprovalBody {
  approve: boolean;
  visibilityPreviewHash: string;
}

interface PublishApprovalDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadGroupPublishApprovalContext: (
    groupId: string,
    memberId: string
  ) => Promise<{ group: GroupDraft; currentVisibilityPreviewHash: string }>;
  now: () => Date;
  saveGroupPublishApproval: (result: unknown) => Promise<GroupDraft>;
}

interface GroupDraft {
  id: string;
  cityId: string;
  format: "quartet" | "social_pod";
  status: string;
  createdByMemberId: string;
  name: string | null;
  intent: string | null;
  neighborhoodIds?: string[];
  availabilityWindows?: AvailabilityWindow[];
  publishApprovedAt?: string | null;
  visibilityPreviewHash?: string | null;
  memberships: Array<{ memberId: string; role: string; status: string; verificationStatus: string; publishApprovedAt: string | null }>;
}

interface GroupInvite {
  id: string;
  groupId: string;
  inviterMemberId: string;
  tokenHash: string;
  recipientHintHash: string | null;
  status: "pending" | "accepted" | "declined" | "expired" | "revoked" | "approval_required";
  expiresAt: string;
  acceptedByMemberId: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
}

const groupFormationApi = api as ApiExports;
const approvedMember: AuthenticatedMember = {
  memberId: "member_1",
  memberStatus: "active",
  verificationStatus: "approved"
};

const groupWithPendingInvite = (): GroupDraft => ({
  id: "group_1",
  cityId: "city_1",
  format: "quartet",
  status: "pending_member",
  createdByMemberId: "member_1",
  name: "Sunday Table",
  intent: "serious",
  neighborhoodIds: ["neighborhood_1"],
  availabilityWindows: [{ startsAt: "2026-06-20T09:00:00.000Z", endsAt: "2026-06-20T11:00:00.000Z", timezone: "Australia/Sydney" }],
  memberships: [
    {
      memberId: "member_1",
      role: "creator",
      status: "active",
      verificationStatus: "approved",
      publishApprovedAt: null
    },
    {
      memberId: "member_2",
      role: "member",
      status: "invited",
      verificationStatus: "approved",
      publishApprovedAt: null
    }
  ]
});

describe("group formation API routes", () => {
  it("publishes group read route metadata", () => {
    expect(groupFormationApi.GET_CURRENT_GROUPS_ROUTE).toEqual({
      method: "GET",
      path: "/v1/groups/current",
      auth: "Member JWT"
    });
    expect(groupFormationApi.GET_GROUP_ROUTE).toEqual({
      method: "GET",
      path: "/v1/groups/{groupId}",
      auth: "Group member"
    });
  });

  it("publishes mutating route metadata with idempotency requirements", () => {
    expect(groupFormationApi.POST_GROUP_ROUTE).toEqual({
      method: "POST",
      path: "/v1/groups",
      auth: "Member JWT",
      requiresIdempotencyKey: true
    });
    expect(groupFormationApi.PATCH_GROUP_ROUTE).toEqual({
      method: "PATCH",
      path: "/v1/groups/{groupId}",
      auth: "Group member",
      requiresIdempotencyKey: true
    });
    expect(groupFormationApi.POST_GROUP_INVITE_ROUTE).toMatchObject({
      method: "POST",
      path: "/v1/groups/{groupId}/invites",
      requiresIdempotencyKey: true
    });
    expect(groupFormationApi.POST_GROUP_INVITE_ACCEPT_ROUTE).toMatchObject({
      method: "POST",
      path: "/v1/group-invites/{token}/accept",
      requiresIdempotencyKey: true
    });
    expect(groupFormationApi.POST_GROUP_PUBLISH_APPROVAL_ROUTE).toEqual({
      method: "POST",
      path: "/v1/groups/{groupId}/publish-approvals",
      auth: "Group member",
      requiresIdempotencyKey: true
    });
    expect(groupFormationApi.POST_GROUP_LEAVE_ROUTE).toEqual({
      method: "POST",
      path: "/v1/groups/{groupId}/leave",
      auth: "Group member",
      requiresIdempotencyKey: true
    });
    expect(groupFormationApi.POST_GROUP_PAUSE_ROUTE).toEqual({
      method: "POST",
      path: "/v1/groups/{groupId}/pause",
      auth: "Group member",
      requiresIdempotencyKey: true
    });
  });

  it("returns current groups for the member without exposing pending invitee identities", async () => {
    expect(groupFormationApi.handleGetCurrentGroups).toBeTypeOf("function");

    const loadCurrentGroupsForMember = vi.fn(async () => ({
      activeGroupId: "group_1",
      groups: [groupWithPendingInvite()]
    }));

    const result = await groupFormationApi.handleGetCurrentGroups?.(
      { member: approvedMember, idempotencyKey: null },
      { loadCurrentGroupsForMember }
    );

    expect(loadCurrentGroupsForMember).toHaveBeenCalledWith("member_1");
    expect(result).toMatchObject({
      activeGroupId: "group_1",
      groups: [
        {
          id: "group_1",
          members: [{ memberId: "member_1", status: "active" }]
        }
      ]
    });
    expect(JSON.stringify(result)).not.toContain("member_2");
  });

  it("returns one group through the group access loader and rejects unauthenticated reads", async () => {
    expect(groupFormationApi.handleGetGroup).toBeTypeOf("function");

    const loadGroupForMember = vi.fn(async () => groupWithPendingInvite());
    const result = await groupFormationApi.handleGetGroup?.(
      { member: approvedMember, idempotencyKey: null },
      { groupId: "group_1" },
      { loadGroupForMember }
    );

    expect(loadGroupForMember).toHaveBeenCalledWith("group_1", "member_1");
    expect(result).toMatchObject({
      id: "group_1",
      members: [{ memberId: "member_1", status: "active" }]
    });
    expect(JSON.stringify(result)).not.toContain("member_2");

    await expect(
      groupFormationApi.handleGetGroup?.(
        { member: null, idempotencyKey: null },
        { groupId: "group_1" },
        { loadGroupForMember }
      )
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("creates a non-eligible group shell only for a verified member and reserves idempotency first", async () => {
    expect(groupFormationApi.handlePostGroup).toBeTypeOf("function");

    const reserveIdempotencyKey = vi.fn(async () => undefined);
    const saveGroupDraft = vi.fn(async (group: unknown) => group);
    const result = await groupFormationApi.handlePostGroup?.(
      { member: approvedMember, idempotencyKey: "idem-create-group" },
      { format: "quartet", cityId: "city_1", name: "Sunday Table", intent: "serious" },
      {
        reserveIdempotencyKey,
        nextGroupId: () => "group_1",
        saveGroupDraft
      }
    );

    expect(reserveIdempotencyKey).toHaveBeenCalledWith("POST /v1/groups", "idem-create-group", "member_1");
    expect(saveGroupDraft).toHaveBeenCalledWith(expect.objectContaining({ id: "group_1", status: "pending_member" }));
    expect(result).toMatchObject({ id: "group_1", status: "pending_member", createdByMemberId: "member_1" });
  });

  it("rejects missing idempotency and unverified creators before persistence", async () => {
    await expect(
      groupFormationApi.handlePostGroup?.(
        { member: approvedMember, idempotencyKey: null },
        { format: "quartet", cityId: "city_1" },
        {
          reserveIdempotencyKey: vi.fn(),
          nextGroupId: () => "group_1",
          saveGroupDraft: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await expect(
      groupFormationApi.handlePostGroup?.(
        { member: { ...approvedMember, verificationStatus: "pending" }, idempotencyKey: "idem-create-group" },
        { format: "quartet", cityId: "city_1" },
        {
          reserveIdempotencyKey: vi.fn(async () => undefined),
          nextGroupId: () => "group_1",
          saveGroupDraft: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VERIFICATION_REQUIRED" });
  });

  it("updates group setup fields, resets publication approvals, and persists metadata-only events", async () => {
    expect(groupFormationApi.handlePatchGroup).toBeTypeOf("function");

    const group = {
      id: "group_1",
      cityId: "city_1",
      format: "quartet",
      status: "eligible",
      createdByMemberId: "member_1",
      name: "Sunday Table",
      intent: "serious",
      neighborhoodIds: ["neighborhood_1"],
      availabilityWindows: [
        { startsAt: "2026-06-20T09:00:00.000Z", endsAt: "2026-06-20T11:00:00.000Z", timezone: "Australia/Sydney" }
      ],
      publishApprovedAt: "2026-06-15T10:05:00.000Z",
      visibilityPreviewHash: "preview_hash_1",
      memberships: [
        {
          memberId: "member_1",
          role: "creator",
          status: "active",
          verificationStatus: "approved",
          publishApprovedAt: "2026-06-15T10:00:00.000Z"
        },
        {
          memberId: "member_2",
          role: "member",
          status: "active",
          verificationStatus: "approved",
          publishApprovedAt: "2026-06-15T10:05:00.000Z"
        }
      ]
    } satisfies GroupDraft;
    const reserveIdempotencyKey = vi.fn(async () => undefined);
    const loadGroupForMember = vi.fn(async () => group);
    const computeVisibilityPreviewHash = vi.fn(() => "preview_hash_2");
    const saveGroupProfileUpdate = vi.fn(async (result: unknown) => result as Awaited<ReturnType<PatchGroupDependencies["saveGroupProfileUpdate"]>>);

    const result = await groupFormationApi.handlePatchGroup?.(
      { member: approvedMember, idempotencyKey: "idem-group-update" },
      { groupId: "group_1" },
      {
        name: "Friday Friends",
        intent: "relationship",
        neighborhoodIds: ["neighborhood_2"],
        availabilityWindows: [
          { startsAt: "2026-06-21T09:00:00.000Z", endsAt: "2026-06-21T11:00:00.000Z", timezone: "Australia/Sydney" }
        ]
      },
      {
        reserveIdempotencyKey,
        loadGroupForMember,
        computeVisibilityPreviewHash,
        now: () => new Date("2026-06-16T09:00:00.000Z"),
        saveGroupProfileUpdate
      }
    );

    expect(reserveIdempotencyKey).toHaveBeenCalledWith("PATCH /v1/groups/{groupId}", "idem-group-update", "member_1");
    expect(loadGroupForMember).toHaveBeenCalledWith("group_1", "member_1");
    expect(computeVisibilityPreviewHash).toHaveBeenCalledWith({
      group,
      patch: {
        name: "Friday Friends",
        intent: "relationship",
        neighborhoodIds: ["neighborhood_2"],
        availabilityWindows: [
          { startsAt: "2026-06-21T09:00:00.000Z", endsAt: "2026-06-21T11:00:00.000Z", timezone: "Australia/Sydney" }
        ]
      }
    });
    expect(saveGroupProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        group: expect.objectContaining({
          id: "group_1",
          status: "pending_publish_approval",
          publishApprovedAt: null,
          visibilityPreviewHash: "preview_hash_2"
        }),
        outboxEvents: expect.arrayContaining([
          expect.objectContaining({ eventName: "group.profile_updated" }),
          expect.objectContaining({ eventName: "group.eligibility_changed" })
        ])
      })
    );
    expect(result).toMatchObject({ id: "group_1", status: "pending_publish_approval", name: "Friday Friends" });
    expect(JSON.stringify((saveGroupProfileUpdate.mock.calls[0]?.[0] as { outboxEvents?: unknown[] }).outboxEvents)).not.toMatch(
      /Friday Friends|relationship|neighborhood_2/i
    );
  });

  it("rejects raw calendar content in group setup availability updates", async () => {
    await expect(
      groupFormationApi.handlePatchGroup?.(
        { member: approvedMember, idempotencyKey: "idem-group-update" },
        { groupId: "group_1" },
        {
          name: "Friday Friends",
          eventTitle: "Dinner with Alex",
          availabilityWindows: [
            { startsAt: "2026-06-21T09:00:00.000Z", endsAt: "2026-06-21T11:00:00.000Z", timezone: "Australia/Sydney" }
          ]
        },
        {
          reserveIdempotencyKey: vi.fn(async () => undefined),
          loadGroupForMember: vi.fn(),
          computeVisibilityPreviewHash: vi.fn(),
          now: () => new Date("2026-06-16T09:00:00.000Z"),
          saveGroupProfileUpdate: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("creates invites from a hashed token and hashed recipient hint without persisting raw contact data", async () => {
    expect(groupFormationApi.handlePostGroupInvite).toBeTypeOf("function");

    const group = {
      id: "group_1",
      cityId: "city_1",
      format: "quartet",
      status: "pending_member",
      createdByMemberId: "member_1",
      name: null,
      intent: null,
      memberships: [{ memberId: "member_1", role: "creator", status: "active", verificationStatus: "approved", publishApprovedAt: null }]
    } satisfies GroupDraft;
    const saveGroupInvite = vi.fn(async (invite: unknown) => invite);

    const result = await groupFormationApi.handlePostGroupInvite?.(
      { member: approvedMember, idempotencyKey: "idem-invite" },
      { groupId: "group_1" },
      { recipientHint: "raw-phone-or-email", expiresInHours: 48 },
      {
        reserveIdempotencyKey: vi.fn(async () => undefined),
        loadGroupForMember: vi.fn(async () => group),
        nextInviteId: () => "invite_1",
        createInviteToken: () => ({ tokenHash: "sha256:token", shareUrl: "https://thenine.com/invite/plain-token" }),
        hashRecipientHint: vi.fn(() => "sha256:recipient"),
        now: () => new Date("2026-06-16T00:00:00.000Z"),
        saveGroupInvite
      }
    );

    expect(saveGroupInvite).toHaveBeenCalledWith(
      expect.not.objectContaining({ recipientHint: "raw-phone-or-email", phone: "raw-phone-or-email", email: "raw-phone-or-email" })
    );
    expect(result).toEqual({
      inviteId: "invite_1",
      shareUrl: "https://thenine.com/invite/plain-token",
      expiresAt: "2026-06-18T00:00:00.000Z"
    });
  });

  it("accepts a consented invite by hashed token for a verified invitee", async () => {
    expect(groupFormationApi.handleAcceptGroupInvite).toBeTypeOf("function");

    const group = {
      id: "group_1",
      cityId: "city_1",
      format: "quartet",
      status: "pending_member",
      createdByMemberId: "member_1",
      name: null,
      intent: null,
      memberships: [{ memberId: "member_1", role: "creator", status: "active", verificationStatus: "approved", publishApprovedAt: null }]
    } satisfies GroupDraft;
    const invite: GroupInvite = {
      id: "invite_1",
      groupId: "group_1",
      inviterMemberId: "member_1",
      tokenHash: "sha256:token",
      recipientHintHash: null,
      status: "pending",
      expiresAt: "2026-06-18T00:00:00.000Z",
      acceptedByMemberId: null,
      acceptedAt: null,
      revokedAt: null
    };
    const saveAcceptedInvite = vi.fn(async (result: unknown) => result);

    const result = await groupFormationApi.handleAcceptGroupInvite?.(
      { member: { ...approvedMember, memberId: "member_2" }, idempotencyKey: "idem-accept" },
      { token: "plain-token" },
      { consent: true },
      {
        reserveIdempotencyKey: vi.fn(async () => undefined),
        hashInviteToken: vi.fn(() => "sha256:token"),
        loadInviteByTokenHash: vi.fn(async () => invite),
        loadGroupById: vi.fn(async () => group),
        now: () => new Date("2026-06-16T12:00:00.000Z"),
        saveAcceptedInvite
      }
    );

    expect(saveAcceptedInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        group: expect.objectContaining({ status: "pending_publish_approval" }),
        invite: expect.objectContaining({ status: "accepted", acceptedByMemberId: "member_2" })
      })
    );
    expect(JSON.stringify(saveAcceptedInvite.mock.calls[0])).not.toContain("plain-token");
    expect(result).toMatchObject({
      group: { status: "pending_publish_approval" },
      invite: { status: "accepted", acceptedByMemberId: "member_2" }
    });
  });

  it("rejects invite acceptance without explicit consent", async () => {
    await expect(
      groupFormationApi.handleAcceptGroupInvite?.(
        { member: approvedMember, idempotencyKey: "idem-accept" },
        { token: "plain-token" },
        { consent: false },
        {
          reserveIdempotencyKey: vi.fn(async () => undefined),
          hashInviteToken: vi.fn(() => "sha256:token"),
          loadInviteByTokenHash: vi.fn(),
          loadGroupById: vi.fn(),
          now: () => new Date("2026-06-16T12:00:00.000Z"),
          saveAcceptedInvite: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("leaves a group by persisting the domain transition and returning the public response shape", async () => {
    expect(groupFormationApi.handlePostGroupLeave).toBeTypeOf("function");

    const group = {
      id: "group_1",
      cityId: "city_1",
      format: "quartet",
      status: "eligible",
      createdByMemberId: "member_1",
      name: "Sunday Table",
      intent: "serious",
      memberships: [
        {
          memberId: "member_1",
          role: "creator",
          status: "active",
          verificationStatus: "approved",
          publishApprovedAt: "2026-06-15T10:00:00.000Z"
        },
        {
          memberId: "member_2",
          role: "member",
          status: "active",
          verificationStatus: "approved",
          publishApprovedAt: "2026-06-15T10:05:00.000Z"
        }
      ]
    } satisfies GroupDraft;
    const reserveIdempotencyKey = vi.fn(async () => undefined);
    const loadGroupLeaveContext = vi.fn(async () => ({
      group,
      affectedPlanIds: ["plan_1"],
      affectedConversationIds: ["conversation_1"]
    }));
    const saveGroupLeave = vi.fn(async (result: unknown) => result as Awaited<ReturnType<LeaveGroupDependencies["saveGroupLeave"]>>);

    const result = await groupFormationApi.handlePostGroupLeave?.(
      { member: approvedMember, idempotencyKey: "idem-leave" },
      { groupId: "group_1" },
      { reasonCode: "safety_exit", safetyExit: true },
      {
        reserveIdempotencyKey,
        loadGroupLeaveContext,
        now: () => new Date("2026-06-16T08:00:00.000Z"),
        saveGroupLeave
      }
    );

    expect(reserveIdempotencyKey).toHaveBeenCalledWith("POST /v1/groups/{groupId}/leave", "idem-leave", "member_1");
    expect(loadGroupLeaveContext).toHaveBeenCalledWith("group_1", "member_1");
    expect(saveGroupLeave).toHaveBeenCalledWith(
      expect.objectContaining({
        group: expect.objectContaining({ id: "group_1", status: "ineligible" }),
        affectedPlanIds: ["plan_1"],
        affectedConversationIds: ["conversation_1"],
        outboxEvents: expect.arrayContaining([
          expect.objectContaining({
            eventName: "group.member_left",
            payload: {
              groupId: "group_1",
              memberId: "member_1",
              affectedPlanIds: ["plan_1"],
              affectedConversationIds: ["conversation_1"]
            }
          })
        ])
      })
    );
    expect(result).toEqual({
      group: expect.objectContaining({ id: "group_1", status: "ineligible" }),
      affectedPlanIds: ["plan_1"],
      affectedConversationIds: ["conversation_1"]
    });
    expect(JSON.stringify(result)).not.toMatch(/outboxEvents|safetyExit/i);
  });

  it("approves group publication with idempotency and persists the domain approval event", async () => {
    expect(groupFormationApi.handlePostGroupPublishApproval).toBeTypeOf("function");

    const group = {
      id: "group_1",
      cityId: "city_1",
      format: "quartet",
      status: "pending_publish_approval",
      createdByMemberId: "member_1",
      name: "Sunday Table",
      intent: "serious",
      memberships: [
        {
          memberId: "member_1",
          role: "creator",
          status: "active",
          verificationStatus: "approved",
          publishApprovedAt: "2026-06-15T10:00:00.000Z"
        },
        {
          memberId: "member_2",
          role: "member",
          status: "active",
          verificationStatus: "approved",
          publishApprovedAt: null
        }
      ]
    } satisfies GroupDraft;
    const reserveIdempotencyKey = vi.fn(async () => undefined);
    const loadGroupPublishApprovalContext = vi.fn(async () => ({ group, currentVisibilityPreviewHash: "preview_hash_1" }));
    const saveGroupPublishApproval = vi.fn(async (result: unknown) => (result as { group: GroupDraft }).group);

    const result = await groupFormationApi.handlePostGroupPublishApproval?.(
      { member: { ...approvedMember, memberId: "member_2" }, idempotencyKey: "idem-publish-approval" },
      { groupId: "group_1" },
      { approve: true, visibilityPreviewHash: "preview_hash_1" },
      {
        reserveIdempotencyKey,
        loadGroupPublishApprovalContext,
        now: () => new Date("2026-06-16T10:05:00.000Z"),
        saveGroupPublishApproval
      }
    );

    expect(reserveIdempotencyKey).toHaveBeenCalledWith("POST /v1/groups/{groupId}/publish-approvals", "idem-publish-approval", "member_2");
    expect(loadGroupPublishApprovalContext).toHaveBeenCalledWith("group_1", "member_2");
    expect(saveGroupPublishApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        group: expect.objectContaining({ id: "group_1", status: "eligible" }),
        allApproved: true,
        outboxEvent: expect.objectContaining({
          eventName: "group.publish_approval_changed",
          payload: {
            groupId: "group_1",
            memberId: "member_2",
            approved: true,
            allApproved: true
          }
        })
      })
    );
    expect(result).toMatchObject({ id: "group_1", status: "eligible" });
  });

  it("pauses a group by persisting the domain transition and returning only the group resource", async () => {
    expect(groupFormationApi.handlePostGroupPause).toBeTypeOf("function");

    const group = {
      id: "group_1",
      cityId: "city_1",
      format: "quartet",
      status: "eligible",
      createdByMemberId: "member_1",
      name: "Sunday Table",
      intent: "serious",
      memberships: [
        {
          memberId: "member_1",
          role: "creator",
          status: "active",
          verificationStatus: "approved",
          publishApprovedAt: "2026-06-15T10:00:00.000Z"
        },
        {
          memberId: "member_2",
          role: "member",
          status: "active",
          verificationStatus: "approved",
          publishApprovedAt: "2026-06-15T10:05:00.000Z"
        }
      ]
    } satisfies GroupDraft;
    const reserveIdempotencyKey = vi.fn(async () => undefined);
    const loadGroupForMember = vi.fn(async () => group);
    const saveGroupPause = vi.fn(async (result: unknown) => result as Awaited<ReturnType<PauseGroupDependencies["saveGroupPause"]>>);

    const result = await groupFormationApi.handlePostGroupPause?.(
      { member: approvedMember, idempotencyKey: "idem-pause" },
      { groupId: "group_1" },
      { reasonCode: "need_a_break" },
      {
        reserveIdempotencyKey,
        loadGroupForMember,
        now: () => new Date("2026-06-16T08:00:00.000Z"),
        saveGroupPause
      }
    );

    expect(reserveIdempotencyKey).toHaveBeenCalledWith("POST /v1/groups/{groupId}/pause", "idem-pause", "member_1");
    expect(loadGroupForMember).toHaveBeenCalledWith("group_1", "member_1");
    expect(saveGroupPause).toHaveBeenCalledWith(
      expect.objectContaining({
        group: expect.objectContaining({ id: "group_1", status: "paused" }),
        outboxEvents: expect.arrayContaining([
          expect.objectContaining({
            eventName: "group.paused",
            payload: {
              groupId: "group_1",
              pausedByMemberId: "member_1",
              pausedAt: "2026-06-16T08:00:00.000Z"
            }
          }),
          expect.objectContaining({
            eventName: "group.eligibility_changed",
            payload: {
              groupId: "group_1",
              status: "paused",
              eligibilityStatus: "paused",
              blockers: ["group_not_active"]
            }
          })
        ])
      })
    );
    expect(result).toMatchObject({ id: "group_1", status: "paused" });
    expect(JSON.stringify(result)).not.toMatch(/outboxEvents|need_a_break|reasonCode/i);
  });
});
