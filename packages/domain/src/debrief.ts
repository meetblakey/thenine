import { DomainInvariantError } from "./group-eligibility.js";
import { computeMutualDebriefEdges, getVisibleMutualEdgesForMember } from "./invariants.js";
import type { DebriefInterestInput, DebriefResource, DebriefSignal, MutualDebriefEdge, PlanResource } from "./types.js";

export type DebriefAttendanceStatus = "attended" | "did_not_attend" | "skipped";

export interface DebriefInterestSubmissionInput {
  targetMemberId: string;
  signal: DebriefSignal;
}

export interface DebriefSubmissionInput {
  debriefId: string;
  plan: PlanResource;
  memberId: string;
  groupId: string;
  attendanceStatus: DebriefAttendanceStatus;
  qualityRating?: number;
  safetyConcern: boolean;
  interests?: DebriefInterestSubmissionInput[];
  existingInterests: DebriefInterestInput[];
  submittedAt: string;
}

export interface PrivateDebriefInterestDraft extends DebriefInterestInput {
  visibilityStatus: "private";
}

export interface DebriefSubmittedEventDraft {
  aggregateType: "debrief";
  aggregateId: string;
  eventName: "debrief.submitted";
  eventVersion: 1;
  payload: {
    debriefId: string;
    planId: string;
    submittedAt: string;
  };
}

export interface DebriefSubmissionResult {
  debrief: DebriefResource;
  interests: PrivateDebriefInterestDraft[];
  mutualEdges: MutualDebriefEdge[];
  outboxEvent: DebriefSubmittedEventDraft;
}

export function buildDebriefSubmission(input: DebriefSubmissionInput): DebriefSubmissionResult {
  if (input.plan.status !== "completed") {
    throw new DomainInvariantError("DEBRIEF_NOT_AVAILABLE", "Debrief submission requires a completed Plan.");
  }

  if (!input.plan.groupIds.includes(input.groupId)) {
    throw new DomainInvariantError("FORBIDDEN", "Debrief submission requires a Plan participant group.");
  }

  if (input.qualityRating !== undefined && (input.qualityRating < 1 || input.qualityRating > 5)) {
    throw new DomainInvariantError("VALIDATION_ERROR", "Debrief qualityRating must be between 1 and 5.");
  }

  const interests = (input.interests ?? []).map((interest) => ({
    planId: input.plan.id,
    sourceMemberId: input.memberId,
    targetMemberId: interest.targetMemberId,
    signal: interest.signal,
    visibilityStatus: "private" as const
  }));
  const mutualEdges = getVisibleMutualEdgesForMember({
    viewerMemberId: input.memberId,
    edges: computeMutualDebriefEdges([...input.existingInterests, ...interests])
  });

  return {
    debrief: {
      id: input.debriefId,
      planId: input.plan.id,
      memberId: input.memberId,
      attendanceStatus: input.attendanceStatus,
      qualityRating: input.qualityRating ?? null,
      safetyConcern: input.safetyConcern,
      submittedAt: input.submittedAt
    },
    interests,
    mutualEdges,
    outboxEvent: {
      aggregateType: "debrief",
      aggregateId: input.debriefId,
      eventName: "debrief.submitted",
      eventVersion: 1,
      payload: {
        debriefId: input.debriefId,
        planId: input.plan.id,
        submittedAt: input.submittedAt
      }
    }
  };
}
