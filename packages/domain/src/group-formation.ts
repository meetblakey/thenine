import { DomainInvariantError } from "./group-eligibility.js";
import type { AvailabilityWindow, GroupFormat, GroupStatus, MemberStatus, VerificationStatus } from "./group-eligibility.js";

export { DomainInvariantError } from "./group-eligibility.js";

export interface GroupFormationMember {
  memberId: string;
  memberStatus: MemberStatus;
  verificationStatus: VerificationStatus;
}

export interface GroupFormationMembership {
  memberId: string;
  role: "creator" | "member";
  status: "invited" | "active" | "left";
  verificationStatus: "approved";
  publishApprovedAt: string | null;
  leftAt?: string | null;
  leaveReasonCode?: string | null;
}

export interface GroupDraft {
  id: string;
  cityId: string;
  format: GroupFormat;
  status: GroupStatus;
  createdByMemberId: string;
  name: string | null;
  intent: string | null;
  neighborhoodIds?: string[];
  availabilityWindows?: AvailabilityWindow[];
  eligibilityStatus?: "eligible" | "ineligible";
  eligibilityBlockers?: string[];
  memberships: GroupFormationMembership[];
  publishApprovedAt?: string | null;
  visibilityPreviewHash?: string | null;
}

export interface GroupResourceMember {
  memberId: string;
  role: GroupFormationMembership["role"];
  status: GroupFormationMembership["status"];
  verificationStatus: GroupFormationMembership["verificationStatus"];
  publishApprovedAt: string | null;
}

export interface GroupResource {
  id: string;
  cityId: string;
  format: GroupFormat;
  status: GroupStatus;
  name: string | null;
  intent: string | null;
  neighborhoodIds: string[];
  availabilityWindows: AvailabilityWindow[];
  eligibilityStatus: "eligible" | "ineligible";
  eligibilityBlockers: string[];
  members: GroupResourceMember[];
}

export interface GroupInvite {
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

export interface InviteRelayEvent {
  id: string;
  inviteId: string;
  groupId: string;
  eventType: "created" | "opened" | "declined" | "accepted" | "approval_required" | "approved" | "rejected";
  sourceChannel: "share_link" | "qr_code" | "manual_share";
  occurredAt: string;
}

export interface CreateGroupDraftInput {
  groupId: string;
  cityId: string;
  format: GroupFormat;
  creator: GroupFormationMember;
  name?: string;
  intent?: string;
}

export interface CreateGroupInviteInput {
  inviteId: string;
  group: GroupDraft;
  inviterMemberId: string;
  tokenHash: string;
  recipientHintHash?: string;
  expiresAt: string;
}

export interface AcceptGroupInviteInput {
  group: GroupDraft;
  invite: GroupInvite;
  invitee: GroupFormationMember;
  acceptedAt: string;
}

export interface AcceptGroupInviteResult {
  group: GroupDraft;
  invite: GroupInvite;
  outboxEvent: {
    aggregateType: "group";
    aggregateId: string;
    eventName: "invite.relay_accepted";
    eventVersion: 1;
    payload: {
      inviteId: string;
      groupId: string;
      acceptedByMemberId: string;
      acceptedAt: string;
    };
  };
}

export interface InviteDeclineResult {
  invite: GroupInvite;
  relayEvent: InviteRelayEvent;
  outboxEvent: null;
}

export interface GroupInvitePreview {
  inviterFirstName: string;
  groupPreview: {
    id: string;
    format: GroupFormat;
    cityId: string;
    name: string | null;
  };
  requiresVerification: boolean;
  expiresAt: string;
}

export interface LeaveGroupInput {
  group: GroupDraft;
  memberId: string;
  leftAt: string;
  reasonCode?: string;
  safetyExit?: boolean;
  affectedPlanIds: string[];
  affectedConversationIds: string[];
}

export interface LeaveGroupResult {
  group: GroupDraft;
  affectedPlanIds: string[];
  affectedConversationIds: string[];
  outboxEvents: [
    {
      aggregateType: "group";
      aggregateId: string;
      eventName: "group.member_left";
      eventVersion: 1;
      payload: {
        groupId: string;
        memberId: string;
        affectedPlanIds: string[];
        affectedConversationIds: string[];
      };
    },
    {
      aggregateType: "group";
      aggregateId: string;
      eventName: "group.eligibility_changed";
      eventVersion: 1;
      payload: {
        groupId: string;
        status: "ineligible";
        eligibilityStatus: "ineligible";
        blockers: EligibilityBlockerForLeave[];
      };
    }
  ];
}

type EligibilityBlockerForLeave = "quartet_requires_two_active_verified_members" | "social_pod_requires_complete_verified_group";

export interface PauseGroupInput {
  group: GroupDraft;
  memberId: string;
  pausedAt: string;
  reasonCode?: string;
}

export interface PauseGroupResult {
  group: GroupDraft;
  outboxEvents: [
    {
      aggregateType: "group";
      aggregateId: string;
      eventName: "group.paused";
      eventVersion: 1;
      payload: {
        groupId: string;
        pausedByMemberId: string;
        pausedAt: string;
      };
    },
    {
      aggregateType: "group";
      aggregateId: string;
      eventName: "group.eligibility_changed";
      eventVersion: 1;
      payload: {
        groupId: string;
        status: "paused";
        eligibilityStatus: "paused";
        blockers: ["group_not_active"];
      };
    }
  ];
}

export interface ApproveGroupPublicationInput {
  group: GroupDraft;
  memberId: string;
  approve: boolean;
  visibilityPreviewHash: string;
  currentVisibilityPreviewHash: string;
  approvedAt: string;
}

export interface ApproveGroupPublicationResult {
  group: GroupDraft;
  allApproved: boolean;
  outboxEvent: {
    aggregateType: "group";
    aggregateId: string;
    eventName: "group.publish_approval_changed";
    eventVersion: 1;
    payload: {
      groupId: string;
      memberId: string;
      approved: boolean;
      allApproved: boolean;
    };
  };
}

export type GroupProfileField = "name" | "intent" | "neighborhoodIds" | "availabilityWindows";

export interface GroupProfilePatch {
  name?: string;
  intent?: string;
  neighborhoodIds?: string[];
  availabilityWindows?: AvailabilityWindow[];
}

export interface UpdateGroupProfileInput {
  group: GroupDraft;
  memberId: string;
  patch: GroupProfilePatch;
  visibilityPreviewHash: string;
  updatedAt: string;
}

export interface GroupProfileUpdatedEventDraft {
  aggregateType: "group";
  aggregateId: string;
  eventName: "group.profile_updated";
  eventVersion: 1;
  payload: {
    groupId: string;
    updatedByMemberId: string;
    visibilityPreviewHash: string;
    fieldsChanged: GroupProfileField[];
  };
}

export interface GroupProfileEligibilityChangedEventDraft {
  aggregateType: "group";
  aggregateId: string;
  eventName: "group.eligibility_changed";
  eventVersion: 1;
  payload: {
    groupId: string;
    status: "pending_publish_approval";
    eligibilityStatus: "ineligible";
    blockers: ["publish_approval_required"];
  };
}

export interface UpdateGroupProfileResult {
  group: GroupDraft;
  outboxEvents: [GroupProfileUpdatedEventDraft] | [GroupProfileUpdatedEventDraft, GroupProfileEligibilityChangedEventDraft];
}

const verificationRequiredError = new DomainInvariantError(
  "VERIFICATION_REQUIRED",
  "Members must be verified before creating or joining Groups."
);

export function createGroupDraft(input: CreateGroupDraftInput): GroupDraft {
  assertVerifiedActiveMember(input.creator);

  return {
    id: input.groupId,
    cityId: input.cityId,
    format: input.format,
    status: "pending_member",
    createdByMemberId: input.creator.memberId,
    name: input.name ?? null,
    intent: input.intent ?? null,
    memberships: [
      {
        memberId: input.creator.memberId,
        role: "creator",
        status: "active",
        verificationStatus: "approved",
        publishApprovedAt: null
      }
    ]
  };
}

export function buildGroupResourceForMember(input: { group: GroupDraft; viewerMemberId: string }): GroupResource {
  const viewerMembership = input.group.memberships.find((membership) => membership.memberId === input.viewerMemberId);

  if (viewerMembership === undefined || viewerMembership.status !== "active") {
    throw new DomainInvariantError("GROUP_ACCESS_DENIED", "Only active Group members can read Group draft resources.");
  }

  return {
    id: input.group.id,
    cityId: input.group.cityId,
    format: input.group.format,
    status: input.group.status,
    name: input.group.name,
    intent: input.group.intent,
    neighborhoodIds: [...(input.group.neighborhoodIds ?? [])],
    availabilityWindows: (input.group.availabilityWindows ?? []).map((window) => ({ ...window })),
    eligibilityStatus: input.group.eligibilityStatus ?? (input.group.status === "eligible" ? "eligible" : "ineligible"),
    eligibilityBlockers: [...(input.group.eligibilityBlockers ?? [])],
    members: input.group.memberships
      .filter((membership) => membership.status !== "invited")
      .map((membership) => ({
        memberId: membership.memberId,
        role: membership.role,
        status: membership.status,
        verificationStatus: membership.verificationStatus,
        publishApprovedAt: membership.publishApprovedAt
      }))
  };
}

export function createGroupInvite(input: CreateGroupInviteInput): GroupInvite {
  if (!input.group.memberships.some((membership) => membership.memberId === input.inviterMemberId && membership.status === "active")) {
    throw new DomainInvariantError("GROUP_ACCESS_DENIED", "Only active Group members can create Group invites.");
  }

  return {
    id: input.inviteId,
    groupId: input.group.id,
    inviterMemberId: input.inviterMemberId,
    tokenHash: input.tokenHash,
    recipientHintHash: input.recipientHintHash ?? null,
    status: "pending",
    expiresAt: input.expiresAt,
    acceptedByMemberId: null,
    acceptedAt: null,
    revokedAt: null
  };
}

export function acceptGroupInvite(input: AcceptGroupInviteInput): AcceptGroupInviteResult {
  assertInviteAcceptable(input.invite, input.acceptedAt);
  assertVerifiedActiveMember(input.invitee);

  const acceptedMembership: GroupFormationMembership = {
    memberId: input.invitee.memberId,
    role: "member",
    status: "active",
    verificationStatus: "approved",
    publishApprovedAt: null
  };

  return {
    group: {
      ...input.group,
      status: "pending_publish_approval",
      memberships: [...input.group.memberships, acceptedMembership]
    },
    invite: {
      ...input.invite,
      status: "accepted",
      acceptedByMemberId: input.invitee.memberId,
      acceptedAt: input.acceptedAt
    },
    outboxEvent: {
      aggregateType: "group",
      aggregateId: input.group.id,
      eventName: "invite.relay_accepted",
      eventVersion: 1,
      payload: {
        inviteId: input.invite.id,
        groupId: input.group.id,
        acceptedByMemberId: input.invitee.memberId,
        acceptedAt: input.acceptedAt
      }
    }
  };
}

export function createInviteRelayEvent(input: {
  eventId: string;
  invite: GroupInvite;
  eventType: InviteRelayEvent["eventType"];
  sourceChannel: InviteRelayEvent["sourceChannel"];
  occurredAt: string;
}): InviteRelayEvent {
  return {
    id: input.eventId,
    inviteId: input.invite.id,
    groupId: input.invite.groupId,
    eventType: input.eventType,
    sourceChannel: input.sourceChannel,
    occurredAt: input.occurredAt
  };
}

export function buildGroupInvitePreview(input: {
  invite: GroupInvite;
  inviterFirstName: string;
  group: { id: string; format: GroupFormat; cityId: string; name: string | null };
  viewerVerificationStatus: VerificationStatus | null;
  viewedAt: string;
}): GroupInvitePreview {
  assertInvitePending(input.invite);

  const viewedAtMs = Date.parse(input.viewedAt);
  const expiresAtMs = Date.parse(input.invite.expiresAt);

  if (Number.isNaN(viewedAtMs) || Number.isNaN(expiresAtMs) || viewedAtMs > expiresAtMs) {
    throw new DomainInvariantError("INVITE_NOT_ACCEPTABLE", "Invite must be pending and unexpired before it can be previewed.");
  }

  return {
    inviterFirstName: input.inviterFirstName,
    groupPreview: {
      id: input.group.id,
      format: input.group.format,
      cityId: input.group.cityId,
      name: input.group.name
    },
    requiresVerification: input.viewerVerificationStatus !== "approved",
    expiresAt: input.invite.expiresAt
  };
}

export function declineGroupInvite(input: {
  eventId: string;
  invite: GroupInvite;
  sourceChannel: InviteRelayEvent["sourceChannel"];
  declinedAt: string;
}): InviteDeclineResult {
  assertInvitePending(input.invite);

  const invite = {
    ...input.invite,
    status: "declined" as const
  };

  return {
    invite,
    relayEvent: createInviteRelayEvent({
      eventId: input.eventId,
      invite,
      eventType: "declined",
      sourceChannel: input.sourceChannel,
      occurredAt: input.declinedAt
    }),
    outboxEvent: null
  };
}

export function reviewForwardedGroupInvite(input: {
  eventId: string;
  invite: GroupInvite;
  approved: boolean;
  reviewedAt: string;
}): { invite: GroupInvite; relayEvent: InviteRelayEvent } {
  if (input.invite.status !== "approval_required") {
    throw new DomainInvariantError("UNPROCESSABLE_STATE", "Only forwarded invites awaiting approval can be reviewed.");
  }

  const invite = input.approved
    ? { ...input.invite, status: "pending" as const }
    : { ...input.invite, status: "revoked" as const, revokedAt: input.reviewedAt };

  return {
    invite,
    relayEvent: createInviteRelayEvent({
      eventId: input.eventId,
      invite,
      eventType: input.approved ? "approved" : "rejected",
      sourceChannel: "share_link",
      occurredAt: input.reviewedAt
    })
  };
}

export function leaveGroup(input: LeaveGroupInput): LeaveGroupResult {
  const leavingMembership = input.group.memberships.find((membership) => membership.memberId === input.memberId);

  if (leavingMembership === undefined) {
    throw new DomainInvariantError("GROUP_ACCESS_DENIED", "Only active Group members can leave a Group.");
  }

  if (leavingMembership.status !== "active") {
    throw new DomainInvariantError("UNPROCESSABLE_STATE", "Only active Group memberships can leave a Group.");
  }

  const group: GroupDraft = {
    ...input.group,
    status: "ineligible",
    memberships: input.group.memberships.map((membership) =>
      membership.memberId === input.memberId
        ? {
            ...membership,
            status: "left",
            leftAt: input.leftAt,
            leaveReasonCode: input.reasonCode ?? null
          }
        : membership
    )
  };

  return {
    group,
    affectedPlanIds: input.affectedPlanIds,
    affectedConversationIds: input.affectedConversationIds,
    outboxEvents: [
      {
        aggregateType: "group",
        aggregateId: input.group.id,
        eventName: "group.member_left",
        eventVersion: 1,
        payload: {
          groupId: input.group.id,
          memberId: input.memberId,
          affectedPlanIds: input.affectedPlanIds,
          affectedConversationIds: input.affectedConversationIds
        }
      },
      {
        aggregateType: "group",
        aggregateId: input.group.id,
        eventName: "group.eligibility_changed",
        eventVersion: 1,
        payload: {
          groupId: input.group.id,
          status: "ineligible",
          eligibilityStatus: "ineligible",
          blockers: [eligibilityBlockerForLeave(input.group.format)]
        }
      }
    ]
  };
}

export function pauseGroup(input: PauseGroupInput): PauseGroupResult {
  const pausingMembership = input.group.memberships.find((membership) => membership.memberId === input.memberId);

  if (pausingMembership === undefined || pausingMembership.status !== "active") {
    throw new DomainInvariantError("GROUP_ACCESS_DENIED", "Only active Group members can pause a Group.");
  }

  if (input.group.status === "paused" || input.group.status === "dissolved" || input.group.status === "ineligible") {
    throw new DomainInvariantError("UNPROCESSABLE_STATE", "Only active Groups can be paused.");
  }

  const group: GroupDraft = {
    ...input.group,
    status: "paused"
  };

  return {
    group,
    outboxEvents: [
      {
        aggregateType: "group",
        aggregateId: input.group.id,
        eventName: "group.paused",
        eventVersion: 1,
        payload: {
          groupId: input.group.id,
          pausedByMemberId: input.memberId,
          pausedAt: input.pausedAt
        }
      },
      {
        aggregateType: "group",
        aggregateId: input.group.id,
        eventName: "group.eligibility_changed",
        eventVersion: 1,
        payload: {
          groupId: input.group.id,
          status: "paused",
          eligibilityStatus: "paused",
          blockers: ["group_not_active"]
        }
      }
    ]
  };
}

export function approveGroupPublication(input: ApproveGroupPublicationInput): ApproveGroupPublicationResult {
  if (input.visibilityPreviewHash.trim() === "" || input.visibilityPreviewHash !== input.currentVisibilityPreviewHash) {
    throw new DomainInvariantError("CONFLICT", "Publish approval must match the current visibility preview.");
  }

  const approvingMembership = input.group.memberships.find((membership) => membership.memberId === input.memberId);

  if (approvingMembership === undefined || approvingMembership.status !== "active") {
    throw new DomainInvariantError("GROUP_ACCESS_DENIED", "Only active Group members can approve publication.");
  }

  if (input.group.status !== "pending_publish_approval" && input.group.status !== "eligible") {
    throw new DomainInvariantError("GROUP_NOT_COMPLETE", "Group must be complete before publication approval.");
  }

  const memberships = input.group.memberships.map((membership) =>
    membership.memberId === input.memberId
      ? {
          ...membership,
          publishApprovedAt: input.approve ? input.approvedAt : null
        }
      : membership
  );
  const activeMemberships = memberships.filter((membership) => membership.status === "active");
  const allApproved = activeMemberships.length > 0 && activeMemberships.every((membership) => membership.publishApprovedAt !== null);

  return {
    group: {
      ...input.group,
      status: allApproved ? "eligible" : "pending_publish_approval",
      memberships,
      publishApprovedAt: allApproved ? input.approvedAt : null,
      visibilityPreviewHash: input.currentVisibilityPreviewHash
    },
    allApproved,
    outboxEvent: {
      aggregateType: "group",
      aggregateId: input.group.id,
      eventName: "group.publish_approval_changed",
      eventVersion: 1,
      payload: {
        groupId: input.group.id,
        memberId: input.memberId,
        approved: input.approve,
        allApproved
      }
    }
  };
}

export function updateGroupProfile(input: UpdateGroupProfileInput): UpdateGroupProfileResult {
  const updatingMembership = input.group.memberships.find((membership) => membership.memberId === input.memberId);

  if (updatingMembership === undefined || updatingMembership.status !== "active") {
    throw new DomainInvariantError("GROUP_ACCESS_DENIED", "Only active Group members can update Group setup fields.");
  }

  if (input.visibilityPreviewHash.trim() === "") {
    throw new DomainInvariantError("VALIDATION_ERROR", "Group setup updates require a visibility preview hash.");
  }

  if (Number.isNaN(Date.parse(input.updatedAt))) {
    throw new DomainInvariantError("VALIDATION_ERROR", "Group setup updates require a valid update timestamp.");
  }

  const fieldsChanged = groupProfileFields.filter((field) => input.patch[field] !== undefined);

  if (fieldsChanged.length === 0) {
    throw new DomainInvariantError("VALIDATION_ERROR", "Group setup update must include at least one supported field.");
  }

  const normalizedPatch = normalizeGroupProfilePatch(input.patch);
  const nextStatus = input.group.status === "eligible" ? "pending_publish_approval" : input.group.status;
  const group: GroupDraft = {
    ...input.group,
    ...normalizedPatch,
    status: nextStatus,
    publishApprovedAt: null,
    visibilityPreviewHash: input.visibilityPreviewHash,
    memberships: input.group.memberships.map((membership) =>
      membership.status === "active"
        ? {
            ...membership,
            publishApprovedAt: null
          }
        : membership
    )
  };
  const profileUpdatedEvent: GroupProfileUpdatedEventDraft = {
    aggregateType: "group",
    aggregateId: input.group.id,
    eventName: "group.profile_updated",
    eventVersion: 1,
    payload: {
      groupId: input.group.id,
      updatedByMemberId: input.memberId,
      visibilityPreviewHash: input.visibilityPreviewHash,
      fieldsChanged
    }
  };

  if (input.group.status !== "eligible" || nextStatus !== "pending_publish_approval") {
    return {
      group,
      outboxEvents: [profileUpdatedEvent]
    };
  }

  return {
    group,
    outboxEvents: [
      profileUpdatedEvent,
      {
        aggregateType: "group",
        aggregateId: input.group.id,
        eventName: "group.eligibility_changed",
        eventVersion: 1,
        payload: {
          groupId: input.group.id,
          status: "pending_publish_approval",
          eligibilityStatus: "ineligible",
          blockers: ["publish_approval_required"]
        }
      }
    ]
  };
}

function assertVerifiedActiveMember(member: GroupFormationMember): void {
  if (member.memberStatus !== "active" || member.verificationStatus !== "approved") {
    throw verificationRequiredError;
  }
}

function assertInviteAcceptable(invite: GroupInvite, acceptedAt: string): void {
  const acceptedAtMs = Date.parse(acceptedAt);
  const expiresAtMs = Date.parse(invite.expiresAt);

  if (invite.status !== "pending" || Number.isNaN(acceptedAtMs) || Number.isNaN(expiresAtMs) || acceptedAtMs > expiresAtMs) {
    throw new DomainInvariantError("INVITE_NOT_ACCEPTABLE", "Invite must be pending and unexpired before it can be accepted.");
  }
}

function assertInvitePending(invite: GroupInvite): void {
  if (invite.status !== "pending") {
    throw new DomainInvariantError("INVITE_NOT_ACCEPTABLE", "Invite must be pending before it can be updated.");
  }
}

function eligibilityBlockerForLeave(format: GroupFormat): EligibilityBlockerForLeave {
  return format === "quartet" ? "quartet_requires_two_active_verified_members" : "social_pod_requires_complete_verified_group";
}

const groupProfileFields = ["name", "intent", "neighborhoodIds", "availabilityWindows"] as const satisfies readonly GroupProfileField[];

function normalizeGroupProfilePatch(patch: GroupProfilePatch): Partial<Pick<GroupDraft, GroupProfileField>> {
  const normalizedPatch: Partial<Pick<GroupDraft, GroupProfileField>> = {};

  if (patch.name !== undefined) {
    const name = patch.name.trim();

    if (name === "") {
      throw new DomainInvariantError("VALIDATION_ERROR", "Group name cannot be blank.");
    }

    normalizedPatch.name = name;
  }

  if (patch.intent !== undefined) {
    const intent = patch.intent.trim();

    if (intent === "") {
      throw new DomainInvariantError("VALIDATION_ERROR", "Group intent cannot be blank.");
    }

    normalizedPatch.intent = intent;
  }

  if (patch.neighborhoodIds !== undefined) {
    normalizedPatch.neighborhoodIds = [...patch.neighborhoodIds];
  }

  if (patch.availabilityWindows !== undefined) {
    normalizedPatch.availabilityWindows = patch.availabilityWindows.map((window) => normalizeAvailabilityWindow(window));
  }

  return normalizedPatch;
}

function normalizeAvailabilityWindow(window: AvailabilityWindow): AvailabilityWindow {
  const startsAtMs = Date.parse(window.startsAt);
  const endsAtMs = Date.parse(window.endsAt);

  if (Number.isNaN(startsAtMs) || Number.isNaN(endsAtMs) || startsAtMs >= endsAtMs || window.timezone.trim() === "") {
    throw new DomainInvariantError("VALIDATION_ERROR", "Availability windows require valid start, end, and timezone values.");
  }

  return {
    startsAt: new Date(startsAtMs).toISOString(),
    endsAt: new Date(endsAtMs).toISOString(),
    timezone: window.timezone
  };
}
