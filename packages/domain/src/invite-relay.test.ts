import { describe, expect, it } from "vitest";
import * as domain from "./index.js";
import type { GroupInvite } from "./group-formation.js";

interface InviteRelayEvent {
  id: string;
  inviteId: string;
  groupId: string;
  eventType: "created" | "opened" | "declined" | "accepted" | "approval_required" | "approved" | "rejected";
  sourceChannel: "share_link" | "qr_code" | "manual_share";
  occurredAt: string;
}

type InviteRelayExports = typeof domain & {
  buildGroupInvitePreview?: (input: {
    invite: GroupInvite;
    inviterFirstName: string;
    group: { id: string; format: "quartet" | "social_pod"; cityId: string; name: string | null };
    viewerVerificationStatus: "not_started" | "pending" | "retry_required" | "approved" | "rejected" | "appeal_pending" | null;
    viewedAt: string;
  }) => {
    inviterFirstName: string;
    groupPreview: { id: string; format: "quartet" | "social_pod"; cityId: string; name: string | null };
    requiresVerification: boolean;
    expiresAt: string;
  };
  createInviteRelayEvent?: (input: {
    eventId: string;
    invite: GroupInvite;
    eventType: InviteRelayEvent["eventType"];
    sourceChannel: InviteRelayEvent["sourceChannel"];
    occurredAt: string;
  }) => InviteRelayEvent;
  declineGroupInvite?: (input: {
    eventId: string;
    invite: GroupInvite;
    sourceChannel: InviteRelayEvent["sourceChannel"];
    declinedAt: string;
  }) => { invite: GroupInvite; relayEvent: InviteRelayEvent; outboxEvent: null };
  reviewForwardedGroupInvite?: (input: {
    eventId: string;
    invite: GroupInvite;
    approved: boolean;
    reviewedAt: string;
  }) => { invite: GroupInvite; relayEvent: InviteRelayEvent };
};

const inviteRelay = domain as InviteRelayExports;

const pendingInvite = (overrides: Partial<GroupInvite> = {}): GroupInvite => ({
  id: "invite_1",
  groupId: "group_1",
  inviterMemberId: "member_1",
  tokenHash: "sha256:token",
  recipientHintHash: "sha256:recipient",
  status: "pending",
  expiresAt: "2026-06-18T00:00:00.000Z",
  acceptedByMemberId: null,
  acceptedAt: null,
  revokedAt: null,
  ...overrides
});

describe("invite relay domain", () => {
  it("builds a safe invite preview without exposing invite hashes or non-consenting invitee data", () => {
    expect(inviteRelay.buildGroupInvitePreview).toBeTypeOf("function");

    const preview = inviteRelay.buildGroupInvitePreview?.({
      invite: pendingInvite(),
      inviterFirstName: "Ari",
      group: { id: "group_1", format: "quartet", cityId: "city_1", name: "Sunday Table" },
      viewerVerificationStatus: "pending",
      viewedAt: "2026-06-16T10:00:00.000Z"
    });

    expect(preview).toEqual({
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
    expect(JSON.stringify(preview)).not.toMatch(/tokenHash|recipientHint|acceptedBy|membership|member_2|sha256/i);
  });

  it("records relay events without raw contact data", () => {
    expect(inviteRelay.createInviteRelayEvent).toBeTypeOf("function");

    const event = inviteRelay.createInviteRelayEvent?.({
      eventId: "relay_event_1",
      invite: pendingInvite(),
      eventType: "created",
      sourceChannel: "share_link",
      occurredAt: "2026-06-16T10:00:00.000Z"
    });

    expect(event).toEqual({
      id: "relay_event_1",
      inviteId: "invite_1",
      groupId: "group_1",
      eventType: "created",
      sourceChannel: "share_link",
      occurredAt: "2026-06-16T10:00:00.000Z"
    });
    expect(JSON.stringify(event)).not.toMatch(/phone|email|recipientHint/i);
  });

  it("declines invites privately without creating pressure notifications", () => {
    expect(inviteRelay.declineGroupInvite).toBeTypeOf("function");

    const result = inviteRelay.declineGroupInvite?.({
      eventId: "relay_event_decline",
      invite: pendingInvite(),
      sourceChannel: "share_link",
      declinedAt: "2026-06-16T10:05:00.000Z"
    });

    expect(result).toEqual({
      invite: expect.objectContaining({ id: "invite_1", status: "declined" }),
      relayEvent: {
        id: "relay_event_decline",
        inviteId: "invite_1",
        groupId: "group_1",
        eventType: "declined",
        sourceChannel: "share_link",
        occurredAt: "2026-06-16T10:05:00.000Z"
      },
      outboxEvent: null
    });
  });

  it("lets the inviter approve or reject forwarded invite activation", () => {
    expect(inviteRelay.reviewForwardedGroupInvite).toBeTypeOf("function");

    const approvalRequiredInvite = pendingInvite({ status: "approval_required" });

    expect(
      inviteRelay.reviewForwardedGroupInvite?.({
        eventId: "relay_event_approved",
        invite: approvalRequiredInvite,
        approved: true,
        reviewedAt: "2026-06-16T10:10:00.000Z"
      })
    ).toEqual({
      invite: expect.objectContaining({ id: "invite_1", status: "pending" }),
      relayEvent: expect.objectContaining({ eventType: "approved" })
    });

    expect(
      inviteRelay.reviewForwardedGroupInvite?.({
        eventId: "relay_event_rejected",
        invite: approvalRequiredInvite,
        approved: false,
        reviewedAt: "2026-06-16T10:11:00.000Z"
      })
    ).toEqual({
      invite: expect.objectContaining({ id: "invite_1", status: "revoked", revokedAt: "2026-06-16T10:11:00.000Z" }),
      relayEvent: expect.objectContaining({ eventType: "rejected" })
    });
  });
});
