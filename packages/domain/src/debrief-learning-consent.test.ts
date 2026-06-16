import { describe, expect, it } from "vitest";
import * as domain from "./index.js";
import type { DebriefResource, PlanResource } from "./types.js";

interface DebriefLearningConsentInput {
  consentId: string;
  action: "grant" | "decline" | "revoke";
  debrief: DebriefResource;
  plan: PlanResource;
  memberId: string;
  groupId: string;
  existingConsent: {
    id: string;
    status: "granted" | "declined" | "revoked";
    grantedAt: string | null;
    declinedAt: string | null;
    revokedAt: string | null;
  } | null;
  activeFeatureSnapshotIds: string[];
  featureSnapshotId: string;
  featureVersion: string;
  decidedAt: string;
  expiresAt: string;
}

type DebriefLearningConsentResult = {
  consent: {
    id: string;
    debriefId: string;
    planId: string;
    memberId: string;
    groupId: string;
    status: "granted" | "declined" | "revoked";
    grantedAt: string | null;
    declinedAt: string | null;
    revokedAt: string | null;
  };
  featureSnapshot: null | {
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
  };
  deactivatedFeatureSnapshotIds: string[];
  outboxEvent: {
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
      status: "granted" | "declined" | "revoked";
      decidedAt: string;
    };
  };
};

type DebriefConsentDomainExports = typeof domain & {
  buildDebriefLearningConsent?: (input: DebriefLearningConsentInput) => DebriefLearningConsentResult;
};

const debriefConsentDomain = domain as DebriefConsentDomainExports;

const completedPlan = (): PlanResource => ({
  id: "plan_1",
  format: "quartet",
  status: "completed",
  startsAt: "2026-06-22T09:00:00.000Z",
  venueName: "Harbour Bar",
  groupIds: ["group_1", "group_2"],
  conversationId: "conversation_1",
  venueId: "venue_1",
  manualVenueName: null,
  manualVenueAddress: null,
  endsAt: "2026-06-22T11:00:00.000Z",
  rsvpDeadlineAt: "2026-06-21T09:00:00.000Z",
  options: [],
  rsvps: []
});

const submittedDebrief = (): DebriefResource => ({
  id: "debrief_1",
  planId: "plan_1",
  memberId: "member_a",
  attendanceStatus: "attended",
  qualityRating: 4,
  safetyConcern: false,
  submittedAt: "2026-06-22T12:00:00.000Z"
});

const baseInput = (overrides: Partial<DebriefLearningConsentInput> = {}): DebriefLearningConsentInput => ({
  consentId: "consent_1",
  action: "grant",
  debrief: submittedDebrief(),
  plan: completedPlan(),
  memberId: "member_a",
  groupId: "group_1",
  existingConsent: null,
  activeFeatureSnapshotIds: [],
  featureSnapshotId: "feature_snapshot_1",
  featureVersion: "p0.1",
  decidedAt: "2026-06-22T12:05:00.000Z",
  expiresAt: "2027-06-22T12:05:00.000Z",
  ...overrides
});

describe("debrief learning consent domain", () => {
  it("grants explicit learning consent and builds only aggregate-safe ranking features", () => {
    expect(debriefConsentDomain.buildDebriefLearningConsent).toBeTypeOf("function");

    const result = debriefConsentDomain.buildDebriefLearningConsent?.(baseInput());

    expect(result?.consent).toEqual({
      id: "consent_1",
      debriefId: "debrief_1",
      planId: "plan_1",
      memberId: "member_a",
      groupId: "group_1",
      status: "granted",
      grantedAt: "2026-06-22T12:05:00.000Z",
      declinedAt: null,
      revokedAt: null
    });
    expect(result?.featureSnapshot).toEqual({
      id: "feature_snapshot_1",
      consentId: "consent_1",
      debriefId: "debrief_1",
      planId: "plan_1",
      memberId: "member_a",
      groupId: "group_1",
      featureVersion: "p0.1",
      active: true,
      featurePayload: {
        attendanceStatus: "attended",
        groupCount: 2,
        planFormat: "quartet",
        qualityBand: "positive",
        venueType: "known_venue"
      },
      expiresAt: "2027-06-22T12:05:00.000Z"
    });
    expect(JSON.stringify(result?.featureSnapshot)).not.toMatch(/targetMemberId|signal|crush|compatibilityScore/i);
    expect(result?.outboxEvent.payload).toEqual({
      consentId: "consent_1",
      debriefId: "debrief_1",
      planId: "plan_1",
      groupId: "group_1",
      memberId: "member_a",
      status: "granted",
      decidedAt: "2026-06-22T12:05:00.000Z"
    });
  });

  it("allows declining learning while preserving the submitted debrief", () => {
    expect(debriefConsentDomain.buildDebriefLearningConsent).toBeTypeOf("function");

    const result = debriefConsentDomain.buildDebriefLearningConsent?.(baseInput({ action: "decline" }));

    expect(result?.consent).toMatchObject({
      id: "consent_1",
      debriefId: "debrief_1",
      status: "declined",
      grantedAt: null,
      declinedAt: "2026-06-22T12:05:00.000Z",
      revokedAt: null
    });
    expect(result?.featureSnapshot).toBeNull();
    expect(result?.deactivatedFeatureSnapshotIds).toEqual([]);
  });

  it("revokes future ranking use and marks active derived features inactive", () => {
    expect(debriefConsentDomain.buildDebriefLearningConsent).toBeTypeOf("function");

    const result = debriefConsentDomain.buildDebriefLearningConsent?.(
      baseInput({
        action: "revoke",
        existingConsent: {
          id: "consent_1",
          status: "granted",
          grantedAt: "2026-06-22T12:05:00.000Z",
          declinedAt: null,
          revokedAt: null
        },
        activeFeatureSnapshotIds: ["feature_snapshot_1"]
      })
    );

    expect(result?.consent).toMatchObject({
      id: "consent_1",
      debriefId: "debrief_1",
      status: "revoked",
      grantedAt: "2026-06-22T12:05:00.000Z",
      declinedAt: null,
      revokedAt: "2026-06-22T12:05:00.000Z"
    });
    expect(result?.featureSnapshot).toBeNull();
    expect(result?.deactivatedFeatureSnapshotIds).toEqual(["feature_snapshot_1"]);
  });

  it("rejects consent before a debrief is submitted", () => {
    expect(debriefConsentDomain.buildDebriefLearningConsent).toBeTypeOf("function");

    expect(() =>
      debriefConsentDomain.buildDebriefLearningConsent?.(
        baseInput({
          debrief: {
            ...submittedDebrief(),
            submittedAt: null
          }
        })
      )
    ).toThrow(/submitted debrief/i);
  });
});
