import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";
import type { GroupDraft, GroupInvite } from "@thenine/domain/group-formation";

type VerificationStatus = "not_started" | "pending" | "retry_required" | "approved" | "rejected" | "appeal_pending";

interface AuthenticatedMember {
  memberId: string;
  memberStatus: "active" | "suspended" | "banned" | "deleted";
  verificationStatus: VerificationStatus;
}

interface InviteRelayContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

type InviteRelayApiExports = typeof api & {
  GET_GROUP_INVITE_ROUTE?: { method: string; path: string; auth: string };
  POST_GROUP_INVITE_RELAY_ROUTE?: { method: string; path: string; auth: string; requiresIdempotencyKey: boolean };
  POST_GROUP_INVITE_DECLINE_ROUTE?: { method: string; path: string; auth: string; requiresIdempotencyKey: boolean };
  POST_GROUP_INVITE_APPROVAL_ROUTE?: { method: string; path: string; auth: string; requiresIdempotencyKey: boolean };
  handlePostGroupInviteRelay?: (
    context: InviteRelayContext,
    params: { groupId: string },
    body: { recipientHint?: string; expiresInHours: number; sourceChannel: "share_link" | "qr_code" | "manual_share" },
    dependencies: {
      reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
      loadGroupForMember: (groupId: string, memberId: string) => Promise<GroupDraft>;
      nextInviteId: () => string;
      nextRelayEventId: () => string;
      createInviteToken: () => { tokenHash: string; shareUrl: string };
      hashRecipientHint: (recipientHint: string) => string;
      now: () => Date;
      saveInviteRelay: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    }
  ) => Promise<Record<string, unknown>>;
  handleGetGroupInvitePreview?: (
    context: { member: { memberId: string; verificationStatus: VerificationStatus } | null },
    params: { token: string },
    dependencies: {
      hashInviteToken: (token: string) => string;
      loadInvitePreviewByTokenHash: (tokenHash: string) => Promise<{
        invite: GroupInvite;
        inviterFirstName: string;
        group: { id: string; format: "quartet" | "social_pod"; cityId: string; name: string | null };
      }>;
      now: () => Date;
    }
  ) => Promise<Record<string, unknown>>;
  handleDeclineGroupInvite?: (
    context: InviteRelayContext,
    params: { token: string },
    body: { sourceChannel: "share_link" | "qr_code" | "manual_share" },
    dependencies: {
      reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
      hashInviteToken: (token: string) => string;
      loadInviteByTokenHash: (tokenHash: string) => Promise<GroupInvite>;
      nextRelayEventId: () => string;
      now: () => Date;
      saveInviteDecline: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    }
  ) => Promise<Record<string, unknown>>;
  handlePostGroupInviteApproval?: (
    context: InviteRelayContext,
    params: { token: string },
    body: { approve: boolean },
    dependencies: {
      reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
      hashInviteToken: (token: string) => string;
      loadInviteForInviterApproval: (tokenHash: string, memberId: string) => Promise<GroupInvite>;
      nextRelayEventId: () => string;
      now: () => Date;
      saveInviteApprovalReview: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    }
  ) => Promise<Record<string, unknown>>;
};

const inviteRelayApi = api as InviteRelayApiExports;
const member: AuthenticatedMember = { memberId: "member_1", memberStatus: "active", verificationStatus: "approved" };

const group = (): GroupDraft => ({
  id: "group_1",
  cityId: "city_1",
  format: "quartet",
  status: "pending_member",
  createdByMemberId: "member_1",
  name: null,
  intent: null,
  memberships: [{ memberId: "member_1", role: "creator", status: "active", verificationStatus: "approved", publishApprovedAt: null }]
});

const invite = (status: GroupInvite["status"] = "pending"): GroupInvite => ({
  id: "invite_1",
  groupId: "group_1",
  inviterMemberId: "member_1",
  tokenHash: "sha256:token",
  recipientHintHash: "sha256:recipient",
  status,
  expiresAt: "2026-06-18T00:00:00.000Z",
  acceptedByMemberId: null,
  acceptedAt: null,
  revokedAt: null
});

describe("Invite Relay API routes", () => {
  it("publishes documented Invite Relay route metadata", () => {
    expect(inviteRelayApi.GET_GROUP_INVITE_ROUTE).toEqual({
      method: "GET",
      path: "/v1/group-invites/{token}",
      auth: "Optional member JWT"
    });
    expect(inviteRelayApi.POST_GROUP_INVITE_RELAY_ROUTE).toEqual({
      method: "POST",
      path: "/v1/groups/{groupId}/invite-relay",
      auth: "Group member",
      requiresIdempotencyKey: true
    });
    expect(inviteRelayApi.POST_GROUP_INVITE_DECLINE_ROUTE).toEqual({
      method: "POST",
      path: "/v1/group-invites/{token}/decline",
      auth: "Member JWT",
      requiresIdempotencyKey: true
    });
    expect(inviteRelayApi.POST_GROUP_INVITE_APPROVAL_ROUTE).toEqual({
      method: "POST",
      path: "/v1/group-invites/{token}/approval",
      auth: "Inviter",
      requiresIdempotencyKey: true
    });
  });

  it("loads invite previews from hashed tokens without exposing invite hashes or invitee identity", async () => {
    expect(inviteRelayApi.handleGetGroupInvitePreview).toBeTypeOf("function");

    const loadInvitePreviewByTokenHash = vi.fn(async () => ({
      invite: invite(),
      inviterFirstName: "Ari",
      group: { id: "group_1", format: "quartet" as const, cityId: "city_1", name: "Sunday Table" }
    }));

    const result = await inviteRelayApi.handleGetGroupInvitePreview?.(
      { member: { memberId: "member_2", verificationStatus: "pending" } },
      { token: "plain-token" },
      {
        hashInviteToken: vi.fn(() => "sha256:token"),
        loadInvitePreviewByTokenHash,
        now: () => new Date("2026-06-16T10:00:00.000Z")
      }
    );

    expect(loadInvitePreviewByTokenHash).toHaveBeenCalledWith("sha256:token");
    expect(result).toEqual({
      inviterFirstName: "Ari",
      groupPreview: {
        id: "group_1",
        format: "quartet",
        cityId: "city_1",
        name: "Sunday Table"
      },
      requiresVerification: true,
      expiresAt: "2026-06-18T00:00:00.000Z"
    });
    expect(JSON.stringify(result)).not.toMatch(/plain-token|tokenHash|recipientHint|acceptedBy|member_2|sha256/i);
  });

  it("creates relay invites with hashed recipient hints and relay event tracking", async () => {
    expect(inviteRelayApi.handlePostGroupInviteRelay).toBeTypeOf("function");

    const result = await inviteRelayApi.handlePostGroupInviteRelay?.(
      { member, idempotencyKey: "idem-relay" },
      { groupId: "group_1" },
      { recipientHint: "+61400000000", expiresInHours: 48, sourceChannel: "share_link" },
      {
        reserveIdempotencyKey: vi.fn(async () => undefined),
        loadGroupForMember: vi.fn(async () => group()),
        nextInviteId: () => "invite_1",
        nextRelayEventId: () => "relay_event_1",
        createInviteToken: () => ({ tokenHash: "sha256:token", shareUrl: "https://thenine.com/invite/token" }),
        hashRecipientHint: () => "sha256:recipient",
        now: () => new Date("2026-06-16T10:00:00.000Z"),
        saveInviteRelay: vi.fn(async (input) => input)
      }
    );

    expect(result).toMatchObject({
      invite: { id: "invite_1", recipientHintHash: "sha256:recipient" },
      relayEvent: { id: "relay_event_1", eventType: "created", sourceChannel: "share_link" },
      shareUrl: "https://thenine.com/invite/token"
    });
    expect(JSON.stringify(result)).not.toContain("+61400000000");
  });

  it("declines invites privately without an outbox notification event", async () => {
    expect(inviteRelayApi.handleDeclineGroupInvite).toBeTypeOf("function");

    const result = await inviteRelayApi.handleDeclineGroupInvite?.(
      { member, idempotencyKey: "idem-decline" },
      { token: "token" },
      { sourceChannel: "share_link" },
      {
        reserveIdempotencyKey: vi.fn(async () => undefined),
        hashInviteToken: () => "sha256:token",
        loadInviteByTokenHash: vi.fn(async () => invite()),
        nextRelayEventId: () => "relay_event_decline",
        now: () => new Date("2026-06-16T10:05:00.000Z"),
        saveInviteDecline: vi.fn(async (input) => input)
      }
    );

    expect(result).toMatchObject({
      invite: { id: "invite_1", status: "declined" },
      relayEvent: { eventType: "declined" },
      outboxEvent: null
    });
  });

  it("lets the inviter approve forwarded invite activation", async () => {
    expect(inviteRelayApi.handlePostGroupInviteApproval).toBeTypeOf("function");

    const result = await inviteRelayApi.handlePostGroupInviteApproval?.(
      { member, idempotencyKey: "idem-approval" },
      { token: "token" },
      { approve: true },
      {
        reserveIdempotencyKey: vi.fn(async () => undefined),
        hashInviteToken: () => "sha256:token",
        loadInviteForInviterApproval: vi.fn(async () => invite("approval_required")),
        nextRelayEventId: () => "relay_event_approved",
        now: () => new Date("2026-06-16T10:10:00.000Z"),
        saveInviteApprovalReview: vi.fn(async (input) => input)
      }
    );

    expect(result).toMatchObject({
      invite: { id: "invite_1", status: "pending" },
      relayEvent: { eventType: "approved" }
    });
  });
});
