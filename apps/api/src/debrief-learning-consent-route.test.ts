import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";
import type { DebriefResource, PlanResource } from "@thenine/domain";

interface AuthenticatedMember {
  memberId: string;
}

interface DebriefConsentContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

interface DebriefConsentDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadDebriefConsentAccess: (
    debriefId: string,
    memberId: string
  ) => Promise<{
    debrief: DebriefResource;
    plan: PlanResource;
    groupId: string;
    existingConsent: {
      id: string;
      status: "granted" | "declined" | "revoked";
      grantedAt: string | null;
      declinedAt: string | null;
      revokedAt: string | null;
    } | null;
    activeFeatureSnapshotIds: string[];
  }>;
  nextConsentId: () => string;
  nextFeatureSnapshotId: () => string;
  now: () => Date;
  computeConsentExpiry: (decidedAt: Date) => string;
  persistDebriefLearningConsent: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

type DebriefConsentApiExports = typeof api & {
  POST_DEBRIEF_LEARNING_CONSENT_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handlePostDebriefLearningConsent?: (
    context: DebriefConsentContext,
    params: { debriefId: string },
    body: { action: "grant" | "decline" | "revoke" },
    dependencies: DebriefConsentDependencies
  ) => Promise<Record<string, unknown>>;
};

const debriefConsentApi = api as DebriefConsentApiExports;
const member: AuthenticatedMember = {
  memberId: "member_a"
};

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

const dependencies = (overrides: Partial<DebriefConsentDependencies> = {}): DebriefConsentDependencies => ({
  reserveIdempotencyKey: vi.fn(),
  loadDebriefConsentAccess: vi.fn(async () => ({
    debrief: submittedDebrief(),
    plan: completedPlan(),
    groupId: "group_1",
    existingConsent: null,
    activeFeatureSnapshotIds: []
  })),
  nextConsentId: () => "consent_1",
  nextFeatureSnapshotId: () => "feature_snapshot_1",
  now: () => new Date("2026-06-22T12:05:00.000Z"),
  computeConsentExpiry: () => "2027-06-22T12:05:00.000Z",
  persistDebriefLearningConsent: vi.fn(async (input: Record<string, unknown>) => input),
  ...overrides
});

describe("Debrief learning consent API route", () => {
  it("publishes documented debrief learning consent route metadata", () => {
    expect(debriefConsentApi.POST_DEBRIEF_LEARNING_CONSENT_ROUTE).toEqual({
      method: "POST",
      path: "/v1/debriefs/{debriefId}/learning-consent",
      auth: "Debrief owner",
      requiresIdempotencyKey: true
    });
  });

  it("persists learning consent after idempotency and access checks", async () => {
    expect(debriefConsentApi.handlePostDebriefLearningConsent).toBeTypeOf("function");

    const calls: string[] = [];
    const persistDebriefLearningConsent = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("persist-consent");

      return input;
    });
    const deps = dependencies({
      reserveIdempotencyKey: vi.fn(async () => {
        calls.push("idempotency");
      }),
      loadDebriefConsentAccess: vi.fn(async () => {
        calls.push("access");

        return {
          debrief: submittedDebrief(),
          plan: completedPlan(),
          groupId: "group_1",
          existingConsent: null,
          activeFeatureSnapshotIds: []
        };
      }),
      persistDebriefLearningConsent
    });

    const result = await debriefConsentApi.handlePostDebriefLearningConsent?.(
      { member, idempotencyKey: "idem-consent" },
      { debriefId: "debrief_1" },
      { action: "grant" },
      deps
    );

    expect(calls).toEqual(["idempotency", "access", "persist-consent"]);
    expect(result).toMatchObject({
      consent: {
        id: "consent_1",
        debriefId: "debrief_1",
        planId: "plan_1",
        memberId: "member_a",
        groupId: "group_1",
        status: "granted"
      },
      featureSnapshot: {
        id: "feature_snapshot_1",
        consentId: "consent_1"
      }
    });
    expect(persistDebriefLearningConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxEvent: expect.objectContaining({
          aggregateType: "debrief",
          aggregateId: "debrief_1",
          eventName: "debrief.learning_consent_changed",
          payload: expect.objectContaining({
            consentId: "consent_1",
            debriefId: "debrief_1",
            status: "granted"
          })
        })
      })
    );
    expect(JSON.stringify(persistDebriefLearningConsent.mock.calls[0]?.[0])).not.toMatch(/targetMemberId|crush|compatibilityScore/i);
  });

  it("requires idempotency before consent writes", async () => {
    await expect(
      debriefConsentApi.handlePostDebriefLearningConsent?.(
        { member, idempotencyKey: null },
        { debriefId: "debrief_1" },
        { action: "grant" },
        dependencies()
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
