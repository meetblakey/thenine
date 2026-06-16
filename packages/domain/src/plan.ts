import { DomainInvariantError } from "./group-eligibility.js";
import { assertSafetyActionsWithinOneTap } from "./invariants.js";
import type { ConversationStatus, PlanFormat, PlanResource, SafetyAction } from "./types.js";

export type PlanRsvpStatus = "yes" | "no" | "maybe";
export type AttendanceStatus = "attended" | "missed" | "disputed";

export interface PlanPollTimeOptionInput {
  id: string;
  startsAt: string;
  endsAt: string;
}

export interface PlanPollVenueOptionInput {
  id: string;
  venueId?: string;
  manualLabel?: string;
}

export interface PlanPollInput {
  planId: string;
  conversationId: string;
  cityId: string;
  format: PlanFormat;
  createdByMemberId: string;
  conversation: {
    status: ConversationStatus;
    groupIds: string[];
  };
  timeOptions: PlanPollTimeOptionInput[];
  venueOptions?: PlanPollVenueOptionInput[];
  createdAt: string;
}

export interface PlanPollCreatedEventDraft {
  aggregateType: "plan";
  aggregateId: string;
  eventName: "plan.poll_created";
  eventVersion: 1;
  payload: {
    planId: string;
    conversationId: string;
    optionIds: string[];
  };
}

export interface PlanPollResult {
  plan: PlanResource & { status: "polling" };
  outboxEvent: PlanPollCreatedEventDraft;
  safetySurface: {
    surface: "plan";
    active: true;
    actions: SafetyAction[];
  };
}

export interface PlanRsvpChangeInput {
  plan: PlanResource;
  memberId: string;
  groupId: string;
  status: PlanRsvpStatus;
  reasonCode?: string;
  requiredMemberIds: string[];
  respondedAt: string;
}

export interface PlanRsvpChangedEventDraft {
  aggregateType: "plan";
  aggregateId: string;
  eventName: "plan.rsvp_changed";
  eventVersion: 1;
  payload: {
    planId: string;
    memberId: string;
    groupId: string;
    status: PlanRsvpStatus;
    allRequiredReceived: boolean;
  };
}

export interface PlanRsvpChangeResult {
  plan: PlanResource;
  outboxEvent: PlanRsvpChangedEventDraft;
}

export interface PlanConfirmationInput {
  plan: PlanResource;
  requiredMemberIds: string[];
  confirmedAt: string;
}

export interface PlanConfirmedEventDraft {
  aggregateType: "plan";
  aggregateId: string;
  eventName: "plan.confirmed";
  eventVersion: 1;
  payload: {
    planId: string;
    startsAt: string;
    venueName: string;
    groupIds: string[];
  };
}

export interface PlanConfirmationResult {
  plan: PlanResource;
  outboxEvent: PlanConfirmedEventDraft;
  safetySurface: {
    surface: "plan";
    active: true;
    actions: SafetyAction[];
  };
}

export interface TrustedContactPlanShareInput {
  shareId: string;
  plan: PlanResource;
  memberId: string;
  contactLabel: string;
  contactChannelHash: string;
  sharedAt: string;
}

export interface TrustedContactPlanShareResult {
  share: {
    id: string;
    planId: string;
    memberId: string;
    contactLabel: string;
    contactChannelHash: string;
    deliveryStatus: "queued";
    sharedAt: string;
  };
}

export interface AttendanceConfirmationInput {
  attendanceId: string;
  plan: PlanResource;
  memberId: string;
  groupId: string;
  status: AttendanceStatus;
  reasonCode?: string;
  createdAt: string;
}

export interface AttendanceConfirmationResult {
  attendance: {
    id: string;
    planId: string;
    memberId: string;
    groupId: string;
    status: AttendanceStatus;
    source: "debrief";
    confidence: number;
    reasonCode: string | null;
    createdAt: string;
  };
  response: {
    attendanceId: string;
    planId: string;
    status: AttendanceStatus;
  };
}

const planSafetyActions: SafetyAction[] = ["report", "block", "leave", "urgent_help", "share_plan"];

export function buildPlanPoll(input: PlanPollInput): PlanPollResult {
  if (input.conversation.status !== "active") {
    throw new DomainInvariantError("CONVERSATION_CLOSED", "Conversation is closed for Plan creation.");
  }

  if (input.conversation.groupIds.length < 2) {
    throw new DomainInvariantError("GROUP_INELIGIBLE", "Plans from chat must be group-owned by at least two Groups.");
  }

  if (input.timeOptions.length === 0) {
    throw new DomainInvariantError("VALIDATION_ERROR", "Plan polls require at least one time option.");
  }

  const timeOptions = input.timeOptions.map((option) => {
    assertValidTimeOption(option);

    return {
      id: option.id,
      optionType: "time",
      label: formatTimeOptionLabel(option.startsAt, option.endsAt),
      startsAt: option.startsAt,
      venueId: null
    };
  });
  const venueOptions = (input.venueOptions ?? []).map((option) => {
    if (option.venueId === undefined && (option.manualLabel === undefined || option.manualLabel.trim() === "")) {
      throw new DomainInvariantError("VALIDATION_ERROR", "Venue options require venueId or manualLabel.");
    }

    return {
      id: option.id,
      optionType: "venue",
      label: option.manualLabel ?? `venue:${option.venueId}`,
      startsAt: null,
      venueId: option.venueId ?? null
    };
  });
  const options = [...timeOptions, ...venueOptions];
  const safetySurface = {
    surface: "plan",
    active: true,
    actions: planSafetyActions
  } satisfies PlanPollResult["safetySurface"];

  assertSafetyActionsWithinOneTap(safetySurface);

  return {
    plan: {
      id: input.planId,
      format: input.format,
      status: "polling",
      startsAt: null,
      venueName: null,
      groupIds: input.conversation.groupIds,
      conversationId: input.conversationId,
      venueId: null,
      manualVenueName: null,
      manualVenueAddress: null,
      endsAt: null,
      rsvpDeadlineAt: null,
      options,
      rsvps: []
    },
    outboxEvent: {
      aggregateType: "plan",
      aggregateId: input.planId,
      eventName: "plan.poll_created",
      eventVersion: 1,
      payload: {
        planId: input.planId,
        conversationId: input.conversationId,
        optionIds: options.map((option) => option.id)
      }
    },
    safetySurface
  };
}

export function buildPlanRsvpChange(input: PlanRsvpChangeInput): PlanRsvpChangeResult {
  if (input.plan.status !== "rsvp_requested") {
    throw new DomainInvariantError("RSVP_CLOSED", "Plan RSVP window is not open.");
  }

  if (!input.plan.groupIds.includes(input.groupId) || !input.requiredMemberIds.includes(input.memberId)) {
    throw new DomainInvariantError("FORBIDDEN", "Only required Plan participants can RSVP.");
  }

  const rsvps = upsertRsvp(input.plan.rsvps, {
    memberId: input.memberId,
    groupId: input.groupId,
    status: input.status,
    respondedAt: input.respondedAt
  });
  const rsvpByRequiredMember = new Map(rsvps.map((rsvp) => [rsvp.memberId, rsvp]));
  const allRequiredReceived = input.requiredMemberIds.every((memberId) => rsvpByRequiredMember.get(memberId)?.status === "yes");

  return {
    plan: {
      ...input.plan,
      rsvps
    },
    outboxEvent: {
      aggregateType: "plan",
      aggregateId: input.plan.id,
      eventName: "plan.rsvp_changed",
      eventVersion: 1,
      payload: {
        planId: input.plan.id,
        memberId: input.memberId,
        groupId: input.groupId,
        status: input.status,
        allRequiredReceived
      }
    }
  };
}

export function buildPlanConfirmation(input: PlanConfirmationInput): PlanConfirmationResult {
  if (input.plan.status !== "rsvp_requested") {
    throw new DomainInvariantError("PLAN_NOT_CONFIRMABLE", "Plan is not in a confirmable RSVP state.");
  }

  if (input.plan.startsAt === null || input.plan.endsAt === null) {
    throw new DomainInvariantError("PLAN_NOT_CONFIRMABLE", "Plan confirmation requires exact time details.");
  }

  if (input.plan.venueName === null || (input.plan.venueId === null && input.plan.manualVenueName === null)) {
    throw new DomainInvariantError("PLAN_NOT_CONFIRMABLE", "Plan confirmation requires exact venue details.");
  }

  const rsvpByRequiredMember = new Map(input.plan.rsvps.map((rsvp) => [rsvp.memberId, rsvp]));
  const missingRequiredRsvps = input.requiredMemberIds.filter((memberId) => rsvpByRequiredMember.get(memberId)?.status !== "yes");

  if (missingRequiredRsvps.length > 0) {
    throw new DomainInvariantError("PLAN_NOT_CONFIRMABLE", "Plan confirmation requires all required RSVPs.");
  }

  const safetySurface = {
    surface: "plan",
    active: true,
    actions: planSafetyActions
  } satisfies PlanConfirmationResult["safetySurface"];

  assertSafetyActionsWithinOneTap(safetySurface);

  return {
    plan: {
      ...input.plan,
      status: "confirmed"
    },
    outboxEvent: {
      aggregateType: "plan",
      aggregateId: input.plan.id,
      eventName: "plan.confirmed",
      eventVersion: 1,
      payload: {
        planId: input.plan.id,
        startsAt: input.plan.startsAt,
        venueName: input.plan.venueName,
        groupIds: input.plan.groupIds
      }
    },
    safetySurface
  };
}

export function buildTrustedContactPlanShare(input: TrustedContactPlanShareInput): TrustedContactPlanShareResult {
  if (input.plan.status !== "confirmed") {
    throw new DomainInvariantError("UNPROCESSABLE_STATE", "Only confirmed Plans can be shared with trusted contacts.");
  }

  if (input.plan.startsAt === null || input.plan.venueName === null || (input.plan.venueId === null && input.plan.manualVenueName === null)) {
    throw new DomainInvariantError("UNPROCESSABLE_STATE", "Plan sharing requires confirmed time and venue details.");
  }

  if (input.contactLabel.trim() === "" || input.contactChannelHash.trim() === "") {
    throw new DomainInvariantError("VALIDATION_ERROR", "Plan sharing requires contact label and hashed contact channel.");
  }

  return {
    share: {
      id: input.shareId,
      planId: input.plan.id,
      memberId: input.memberId,
      contactLabel: input.contactLabel,
      contactChannelHash: input.contactChannelHash,
      deliveryStatus: "queued",
      sharedAt: input.sharedAt
    }
  };
}

export function buildAttendanceConfirmation(input: AttendanceConfirmationInput): AttendanceConfirmationResult {
  if (input.plan.status !== "confirmed" && input.plan.status !== "completed") {
    throw new DomainInvariantError("UNPROCESSABLE_STATE", "Attendance confirmation requires a confirmed Plan.");
  }

  if (!input.plan.groupIds.includes(input.groupId)) {
    throw new DomainInvariantError("FORBIDDEN", "Attendance confirmation requires a Plan participant group.");
  }

  return {
    attendance: {
      id: input.attendanceId,
      planId: input.plan.id,
      memberId: input.memberId,
      groupId: input.groupId,
      status: input.status,
      source: "debrief",
      confidence: input.status === "attended" ? 0.5 : 0.25,
      reasonCode: input.reasonCode ?? null,
      createdAt: input.createdAt
    },
    response: {
      attendanceId: input.attendanceId,
      planId: input.plan.id,
      status: input.status
    }
  };
}

function assertValidTimeOption(option: PlanPollTimeOptionInput): void {
  const startsAt = new Date(option.startsAt);
  const endsAt = new Date(option.endsAt);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    throw new DomainInvariantError("VALIDATION_ERROR", "Plan time options require a valid startsAt and later endsAt.");
  }
}

function formatTimeOptionLabel(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][start.getUTCMonth()];

  return `${month} ${start.getUTCDate()}, ${start.getUTCFullYear()}, ${padTime(start.getUTCHours())}:${padTime(start.getUTCMinutes())}-${padTime(end.getUTCHours())}:${padTime(end.getUTCMinutes())}`;
}

function padTime(value: number): string {
  return value.toString().padStart(2, "0");
}

function upsertRsvp(
  rsvps: PlanResource["rsvps"],
  nextRsvp: PlanResource["rsvps"][number]
): PlanResource["rsvps"] {
  const existingIndex = rsvps.findIndex((rsvp) => rsvp.memberId === nextRsvp.memberId);

  if (existingIndex === -1) {
    return [...rsvps, nextRsvp];
  }

  return rsvps.map((rsvp, index) => (index === existingIndex ? nextRsvp : rsvp));
}
