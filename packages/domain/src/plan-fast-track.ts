import { DomainInvariantError } from "./group-eligibility.js";
import { assertSafetyActionsWithinOneTap } from "./invariants.js";
import type { ConversationStatus, PlanFormat, PlanResource, SafetyAction } from "./types.js";

export type PlanFastTrackProposalState = "proposed" | "manual_required" | "accepted" | "expired";
export type PlanFastTrackConfidence = "recommended" | "manual";

export interface PlanFastTrackAvailabilityWindow {
  groupId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
}

export interface PlanFastTrackVenueCandidate {
  venueId: string;
  name: string;
  venueType: string;
  safetyStatus: "approved" | "held" | "blocked";
}

export interface PlanFastTrackInput {
  proposalId: string;
  conversationId: string;
  createdByMemberId: string;
  sourceGroupId: string;
  format: PlanFormat;
  conversation: {
    status: ConversationStatus;
    groupIds: string[];
  };
  availabilityWindows: PlanFastTrackAvailabilityWindow[];
  venueCandidates: PlanFastTrackVenueCandidate[];
  timeOptionIds: string[];
  venueOptionIds: string[];
  createdAt: string;
}

export interface PlanFastTrackTimeOption {
  id: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
}

export interface PlanFastTrackVenueOption {
  id: string;
  venueId: string;
  label: string;
  venueType: string;
  safetyStatus: "approved";
}

export interface PlanFastTrackProposal {
  id: string;
  conversationId: string;
  createdByMemberId: string;
  sourceGroupId: string;
  groupIds: string[];
  format: PlanFormat;
  proposalState: PlanFastTrackProposalState;
  confidence: PlanFastTrackConfidence;
  timeOptions: PlanFastTrackTimeOption[];
  venueOptions: PlanFastTrackVenueOption[];
  safetyContext: { sharePlanAvailable: true; safetyActions: SafetyAction[] };
  createdAt: string;
}

export interface PlanFastTrackProposedEventDraft {
  aggregateType: "conversation";
  aggregateId: string;
  eventName: "plan.fast_track_proposed";
  eventVersion: 1;
  payload: {
    proposalId: string;
    conversationId: string;
    sourceGroupId: string;
    groupIds: string[];
    timeOptionCount: number;
    venueOptionCount: number;
  };
}

export interface PlanFastTrackProposalResult {
  proposal: PlanFastTrackProposal;
  outboxEvent: PlanFastTrackProposedEventDraft;
}

export interface PlanFastTrackAcceptInput {
  proposal: PlanFastTrackProposal;
  planId: string;
  selectedTimeOptionId: string;
  selectedVenueOptionId: string;
  rsvpDeadlineAt: string;
  acceptedAt: string;
}

export interface PlanFastTrackAcceptedEventDraft {
  aggregateType: "plan";
  aggregateId: string;
  eventName: "plan.fast_track_accepted";
  eventVersion: 1;
  payload: {
    proposalId: string;
    planId: string;
    conversationId: string;
    groupIds: string[];
    rsvpDeadlineAt: string;
  };
}

export interface PlanFastTrackAcceptResult {
  plan: PlanResource & { status: "rsvp_requested" };
  outboxEvent: PlanFastTrackAcceptedEventDraft;
}

const planFastTrackSafetyActions: SafetyAction[] = ["report", "block", "leave", "urgent_help", "share_plan"];

export function buildPlanFastTrackProposal(input: PlanFastTrackInput): PlanFastTrackProposalResult {
  if (input.conversation.status !== "active") {
    throw new DomainInvariantError("CONVERSATION_CLOSED", "Conversation is closed for Plan Fast Track.");
  }

  if (input.conversation.groupIds.length < 2) {
    throw new DomainInvariantError("GROUP_INELIGIBLE", "Plan Fast Track requires at least two participant Groups.");
  }

  if (!input.conversation.groupIds.includes(input.sourceGroupId)) {
    throw new DomainInvariantError("FORBIDDEN", "Plan Fast Track source Group must belong to the conversation.");
  }

  const timeOptions = buildTimeOptions(input);
  const venueOptions = buildVenueOptions(input);
  const proposalState: PlanFastTrackProposalState = timeOptions.length > 0 && venueOptions.length > 0 ? "proposed" : "manual_required";
  const safetyContext = {
    sharePlanAvailable: true,
    safetyActions: planFastTrackSafetyActions
  } satisfies PlanFastTrackProposal["safetyContext"];

  assertSafetyActionsWithinOneTap({ surface: "plan", active: true, actions: safetyContext.safetyActions });

  const proposal: PlanFastTrackProposal = {
    id: input.proposalId,
    conversationId: input.conversationId,
    createdByMemberId: input.createdByMemberId,
    sourceGroupId: input.sourceGroupId,
    groupIds: input.conversation.groupIds,
    format: input.format,
    proposalState,
    confidence: proposalState === "proposed" ? "recommended" : "manual",
    timeOptions,
    venueOptions,
    safetyContext,
    createdAt: input.createdAt
  };

  return {
    proposal,
    outboxEvent: {
      aggregateType: "conversation",
      aggregateId: input.conversationId,
      eventName: "plan.fast_track_proposed",
      eventVersion: 1,
      payload: {
        proposalId: input.proposalId,
        conversationId: input.conversationId,
        sourceGroupId: input.sourceGroupId,
        groupIds: input.conversation.groupIds,
        timeOptionCount: timeOptions.length,
        venueOptionCount: venueOptions.length
      }
    }
  };
}

export function acceptPlanFastTrackProposal(input: PlanFastTrackAcceptInput): PlanFastTrackAcceptResult {
  if (input.proposal.proposalState !== "proposed") {
    throw new DomainInvariantError("PLAN_NOT_CONFIRMABLE", "Only proposed Fast Track plans can be accepted.");
  }

  const selectedTime = input.proposal.timeOptions.find((option) => option.id === input.selectedTimeOptionId);
  const selectedVenue = input.proposal.venueOptions.find((option) => option.id === input.selectedVenueOptionId);

  if (selectedTime === undefined || selectedVenue === undefined) {
    throw new DomainInvariantError("VALIDATION_ERROR", "Fast Track acceptance requires selected time and venue options.");
  }

  if (Date.parse(input.rsvpDeadlineAt) >= Date.parse(selectedTime.startsAt)) {
    throw new DomainInvariantError("VALIDATION_ERROR", "RSVP deadline must be before Plan start.");
  }

  return {
    plan: {
      id: input.planId,
      format: input.proposal.format,
      status: "rsvp_requested",
      startsAt: selectedTime.startsAt,
      venueName: selectedVenue.label,
      groupIds: input.proposal.groupIds,
      conversationId: input.proposal.conversationId,
      venueId: selectedVenue.venueId,
      manualVenueName: null,
      manualVenueAddress: null,
      endsAt: selectedTime.endsAt,
      rsvpDeadlineAt: input.rsvpDeadlineAt,
      options: [],
      rsvps: []
    },
    outboxEvent: {
      aggregateType: "plan",
      aggregateId: input.planId,
      eventName: "plan.fast_track_accepted",
      eventVersion: 1,
      payload: {
        proposalId: input.proposal.id,
        planId: input.planId,
        conversationId: input.proposal.conversationId,
        groupIds: input.proposal.groupIds,
        rsvpDeadlineAt: input.rsvpDeadlineAt
      }
    }
  };
}

function buildTimeOptions(input: PlanFastTrackInput): PlanFastTrackTimeOption[] {
  const overlap = firstGroupOverlap(input.conversation.groupIds, input.availabilityWindows);

  if (overlap === null) {
    return [];
  }

  const [timeOptionId] = input.timeOptionIds;

  if (timeOptionId === undefined) {
    throw new DomainInvariantError("UNPROCESSABLE_STATE", "Plan Fast Track requires time option ids.");
  }

  return [{ id: timeOptionId, ...overlap }];
}

function buildVenueOptions(input: PlanFastTrackInput): PlanFastTrackVenueOption[] {
  const approvedVenues = input.venueCandidates.filter((venue) => venue.safetyStatus === "approved");

  return approvedVenues.slice(0, input.venueOptionIds.length).map((venue, index) => {
    const optionId = input.venueOptionIds[index];

    if (optionId === undefined) {
      throw new DomainInvariantError("UNPROCESSABLE_STATE", "Plan Fast Track requires venue option ids.");
    }

    return {
      id: optionId,
      venueId: venue.venueId,
      label: venue.name,
      venueType: venue.venueType,
      safetyStatus: "approved"
    };
  });
}

function firstGroupOverlap(
  groupIds: string[],
  availabilityWindows: PlanFastTrackAvailabilityWindow[]
): Omit<PlanFastTrackTimeOption, "id"> | null {
  const windowsByGroup = groupIds.map((groupId) => availabilityWindows.find((window) => window.groupId === groupId));

  if (windowsByGroup.some((window) => window === undefined)) {
    return null;
  }

  const windows = windowsByGroup as PlanFastTrackAvailabilityWindow[];
  const startsAtMs = Math.max(...windows.map((window) => Date.parse(window.startsAt)));
  const endsAtMs = Math.min(...windows.map((window) => Date.parse(window.endsAt)));

  if (startsAtMs >= endsAtMs) {
    return null;
  }

  return {
    startsAt: new Date(startsAtMs).toISOString(),
    endsAt: new Date(endsAtMs).toISOString(),
    timezone: windows[0]?.timezone ?? "UTC"
  };
}
