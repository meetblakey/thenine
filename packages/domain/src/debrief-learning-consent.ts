import { DomainInvariantError } from "./group-eligibility.js";
import type { DebriefResource, PlanResource } from "./types.js";

export type DebriefLearningConsentAction = "grant" | "decline" | "revoke";
export type DebriefLearningConsentStatus = "granted" | "declined" | "revoked";

export interface ExistingDebriefLearningConsent {
  id: string;
  status: DebriefLearningConsentStatus;
  grantedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
}

export interface DebriefLearningConsentInput {
  consentId: string;
  action: DebriefLearningConsentAction;
  debrief: DebriefResource;
  plan: PlanResource;
  memberId: string;
  groupId: string;
  existingConsent: ExistingDebriefLearningConsent | null;
  activeFeatureSnapshotIds: string[];
  featureSnapshotId: string;
  featureVersion: string;
  decidedAt: string;
  expiresAt: string;
}

export interface DebriefLearningConsentRecord extends ExistingDebriefLearningConsent {
  debriefId: string;
  planId: string;
  memberId: string;
  groupId: string;
}

export interface RecommendationFeatureSnapshotDraft {
  id: string;
  consentId: string;
  debriefId: string;
  planId: string;
  memberId: string;
  groupId: string;
  featureVersion: string;
  active: true;
  featurePayload: Record<string, string | number>;
  expiresAt: string;
}

export interface DebriefLearningConsentChangedEventDraft {
  aggregateType: "debrief";
  aggregateId: string;
  eventName: "debrief.learning_consent_changed";
  eventVersion: 1;
  payload: {
    consentId: string;
    debriefId: string;
    planId: string;
    groupId: string;
    memberId: string;
    status: DebriefLearningConsentStatus;
    decidedAt: string;
  };
}

export interface DebriefLearningConsentResult {
  consent: DebriefLearningConsentRecord;
  featureSnapshot: RecommendationFeatureSnapshotDraft | null;
  deactivatedFeatureSnapshotIds: string[];
  outboxEvent: DebriefLearningConsentChangedEventDraft;
}

export function buildDebriefLearningConsent(input: DebriefLearningConsentInput): DebriefLearningConsentResult {
  assertDebriefConsentEligible(input);

  const status = statusForAction(input.action);
  const consentId = input.existingConsent?.id ?? input.consentId;
  const consent = buildConsentRecord(input, consentId, status);

  return {
    consent,
    featureSnapshot: status === "granted" && canExtractRecommendationFeatures(input)
      ? {
          id: input.featureSnapshotId,
          consentId,
          debriefId: input.debrief.id,
          planId: input.plan.id,
          memberId: input.memberId,
          groupId: input.groupId,
          featureVersion: input.featureVersion,
          active: true,
          featurePayload: {
            attendanceStatus: input.debrief.attendanceStatus,
            groupCount: input.plan.groupIds.length,
            planFormat: input.plan.format,
            qualityBand: qualityBandFor(input.debrief.qualityRating),
            venueType: input.plan.venueId === null ? "manual_venue" : "known_venue"
          },
          expiresAt: input.expiresAt
        }
      : null,
    deactivatedFeatureSnapshotIds: status === "revoked" ? input.activeFeatureSnapshotIds : [],
    outboxEvent: {
      aggregateType: "debrief",
      aggregateId: input.debrief.id,
      eventName: "debrief.learning_consent_changed",
      eventVersion: 1,
      payload: {
        consentId,
        debriefId: input.debrief.id,
        planId: input.plan.id,
        groupId: input.groupId,
        memberId: input.memberId,
        status,
        decidedAt: input.decidedAt
      }
    }
  };
}

function assertDebriefConsentEligible(input: DebriefLearningConsentInput): void {
  if (input.debrief.submittedAt === null) {
    throw new DomainInvariantError("DEBRIEF_NOT_AVAILABLE", "Learning consent requires a submitted debrief.");
  }

  if (input.plan.status !== "completed") {
    throw new DomainInvariantError("DEBRIEF_NOT_AVAILABLE", "Learning consent requires a completed Plan.");
  }

  if (input.debrief.planId !== input.plan.id) {
    throw new DomainInvariantError("FORBIDDEN", "Learning consent requires the debrief Plan.");
  }

  if (input.debrief.memberId !== input.memberId) {
    throw new DomainInvariantError("FORBIDDEN", "Learning consent can only be changed by the debrief owner.");
  }

  if (!input.plan.groupIds.includes(input.groupId)) {
    throw new DomainInvariantError("FORBIDDEN", "Learning consent requires a Plan participant Group.");
  }

  if (input.action === "revoke" && input.existingConsent?.status !== "granted") {
    throw new DomainInvariantError("CONSENT_REQUIRED", "Revoking debrief learning requires active granted consent.");
  }
}

function statusForAction(action: DebriefLearningConsentAction): DebriefLearningConsentStatus {
  switch (action) {
    case "grant":
      return "granted";
    case "decline":
      return "declined";
    case "revoke":
      return "revoked";
  }
}

function buildConsentRecord(
  input: DebriefLearningConsentInput,
  consentId: string,
  status: DebriefLearningConsentStatus
): DebriefLearningConsentRecord {
  return {
    id: consentId,
    debriefId: input.debrief.id,
    planId: input.plan.id,
    memberId: input.memberId,
    groupId: input.groupId,
    status,
    grantedAt: status === "granted" ? input.decidedAt : input.existingConsent?.grantedAt ?? null,
    declinedAt: status === "declined" ? input.decidedAt : input.existingConsent?.declinedAt ?? null,
    revokedAt: status === "revoked" ? input.decidedAt : null
  };
}

function canExtractRecommendationFeatures(input: DebriefLearningConsentInput): boolean {
  return input.debrief.attendanceStatus === "attended" && input.debrief.qualityRating !== null && !input.debrief.safetyConcern;
}

function qualityBandFor(qualityRating: number | null): "negative" | "neutral" | "positive" {
  if (qualityRating === null) {
    return "neutral";
  }

  if (qualityRating >= 4) {
    return "positive";
  }

  if (qualityRating <= 2) {
    return "negative";
  }

  return "neutral";
}
