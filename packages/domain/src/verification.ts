import { DomainInvariantError } from "./group-eligibility.js";
import type { VerificationStatus } from "./types.js";

export interface VerificationProviderEvent {
  provider: "persona";
  eventId: string;
  inquiryId: string;
  occurredAt: string;
  rawStatus: string;
  reasonCode?: string;
  riskTags: string[];
}

export interface VerificationStateTransition {
  provider: "persona";
  providerEventId: string;
  providerInquiryId: string;
  memberId: string;
  previousStatus: VerificationStatus;
  nextStatus: VerificationStatus;
  failureReasonCode: string | null;
  riskFlags: string[];
  emitGroupEligibilityRecompute: boolean;
  outboxEvent: {
    aggregateType: "member";
    aggregateId: string;
    eventName: "verification.status_changed";
    eventVersion: 1;
    payload: {
      memberId: string;
      status: VerificationStatus;
      failureReasonCode: string | null;
    };
  };
}

export interface VerificationAppealSubmission {
  appealStatus: "submitted";
  caseId: string;
  submittedAt: string;
}

export function buildVerificationStateTransition(input: {
  memberId: string;
  previousStatus: VerificationStatus;
  providerEvent: VerificationProviderEvent;
}): VerificationStateTransition {
  const nextStatus = mapPersonaStatus(input.providerEvent.rawStatus);
  const failureReasonCode = nextStatus === "retry_required" || nextStatus === "rejected" ? input.providerEvent.reasonCode ?? null : null;

  return {
    provider: input.providerEvent.provider,
    providerEventId: input.providerEvent.eventId,
    providerInquiryId: input.providerEvent.inquiryId,
    memberId: input.memberId,
    previousStatus: input.previousStatus,
    nextStatus,
    failureReasonCode,
    riskFlags: input.providerEvent.riskTags,
    emitGroupEligibilityRecompute: input.previousStatus !== nextStatus,
    outboxEvent: {
      aggregateType: "member",
      aggregateId: input.memberId,
      eventName: "verification.status_changed",
      eventVersion: 1,
      payload: {
        memberId: input.memberId,
        status: nextStatus,
        failureReasonCode
      }
    }
  };
}

export function submitVerificationAppeal(input: {
  memberId: string;
  verificationStatus: VerificationStatus;
  currentAppealStatus: string | null;
  caseId: string;
  narrative: string;
  contactEmail?: string;
  submittedAt: string;
}): VerificationAppealSubmission {
  if (input.verificationStatus !== "rejected" || input.currentAppealStatus !== "available") {
    throw new DomainInvariantError("UNPROCESSABLE_STATE", "Verification appeal is available only for rejected checks with appeal access.");
  }

  if (input.narrative.trim() === "") {
    throw new DomainInvariantError("VALIDATION_ERROR", "Verification appeal requires a narrative.");
  }

  return {
    appealStatus: "submitted",
    caseId: input.caseId,
    submittedAt: input.submittedAt
  };
}

function mapPersonaStatus(rawStatus: string): VerificationStatus {
  switch (rawStatus) {
    case "approved":
      return "approved";
    case "retry_required":
      return "retry_required";
    case "rejected":
      return "rejected";
    case "pending":
      return "pending";
    default:
      throw new DomainInvariantError("VALIDATION_ERROR", "Persona verification status is not mapped.");
  }
}
