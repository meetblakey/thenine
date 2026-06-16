import { describe, expect, it } from "vitest";
import * as domain from "./index.js";
import type { VerificationStatus } from "./types.js";

interface VerificationProviderEvent {
  provider: "persona";
  eventId: string;
  inquiryId: string;
  occurredAt: string;
  rawStatus: string;
  reasonCode?: string;
  riskTags: string[];
}

interface VerificationStateTransition {
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

type VerificationExports = typeof domain & {
  buildVerificationStateTransition?: (input: {
    memberId: string;
    previousStatus: VerificationStatus;
    providerEvent: VerificationProviderEvent;
  }) => VerificationStateTransition;
  submitVerificationAppeal?: (input: {
    memberId: string;
    verificationStatus: VerificationStatus;
    currentAppealStatus: string | null;
    caseId: string;
    narrative: string;
    contactEmail?: string;
    submittedAt: string;
  }) => { appealStatus: "submitted"; caseId: string; submittedAt: string };
};

const verification = domain as VerificationExports;

describe("verification provider state transitions", () => {
  it("maps normalized Persona approval into a persisted member-private status event", () => {
    expect(verification.buildVerificationStateTransition).toBeTypeOf("function");

    const transition = verification.buildVerificationStateTransition?.({
      memberId: "member_1",
      previousStatus: "pending",
      providerEvent: {
        provider: "persona",
        eventId: "persona_event_1",
        inquiryId: "inq_1",
        occurredAt: "2026-06-16T09:00:00.000Z",
        rawStatus: "approved",
        riskTags: ["document_verified"]
      }
    });

    expect(transition).toEqual({
      provider: "persona",
      providerEventId: "persona_event_1",
      providerInquiryId: "inq_1",
      memberId: "member_1",
      previousStatus: "pending",
      nextStatus: "approved",
      failureReasonCode: null,
      riskFlags: ["document_verified"],
      emitGroupEligibilityRecompute: true,
      outboxEvent: {
        aggregateType: "member",
        aggregateId: "member_1",
        eventName: "verification.status_changed",
        eventVersion: 1,
        payload: {
          memberId: "member_1",
          status: "approved",
          failureReasonCode: null
        }
      }
    });
    expect(JSON.stringify(transition)).not.toMatch(/government|documentImage|liveness|selfie|raw/i);
  });

  it("maps retry and rejection reasons without exposing provider artifacts", () => {
    expect(
      verification.buildVerificationStateTransition?.({
        memberId: "member_1",
        previousStatus: "pending",
        providerEvent: {
          provider: "persona",
          eventId: "persona_event_retry",
          inquiryId: "inq_1",
          occurredAt: "2026-06-16T09:05:00.000Z",
          rawStatus: "retry_required",
          reasonCode: "image_quality",
          riskTags: []
        }
      })
    ).toMatchObject({
      nextStatus: "retry_required",
      failureReasonCode: "image_quality",
      emitGroupEligibilityRecompute: true,
      outboxEvent: {
        payload: {
          status: "retry_required",
          failureReasonCode: "image_quality"
        }
      }
    });

    const rejected = verification.buildVerificationStateTransition?.({
      memberId: "member_1",
      previousStatus: "pending",
      providerEvent: {
        provider: "persona",
        eventId: "persona_event_rejected",
        inquiryId: "inq_1",
        occurredAt: "2026-06-16T09:10:00.000Z",
        rawStatus: "rejected",
        reasonCode: "policy_declined",
        riskTags: ["underage_detected"]
      }
    });

    expect(rejected).toMatchObject({
      nextStatus: "rejected",
      failureReasonCode: "policy_declined",
      riskFlags: ["underage_detected"]
    });
    expect(JSON.stringify(rejected)).not.toMatch(/government|documentImage|liveness|selfie/i);
  });

  it("submits an appeal only for rejected checks with an available appeal path", () => {
    expect(verification.submitVerificationAppeal).toBeTypeOf("function");

    expect(
      verification.submitVerificationAppeal?.({
        memberId: "member_1",
        verificationStatus: "rejected",
        currentAppealStatus: "available",
        caseId: "verification_case_1",
        narrative: "My legal ID was misread.",
        contactEmail: "member@example.com",
        submittedAt: "2026-06-16T09:20:00.000Z"
      })
    ).toEqual({
      appealStatus: "submitted",
      caseId: "verification_case_1",
      submittedAt: "2026-06-16T09:20:00.000Z"
    });

    expect(() =>
      verification.submitVerificationAppeal?.({
        memberId: "member_1",
        verificationStatus: "pending",
        currentAppealStatus: "available",
        caseId: "verification_case_1",
        narrative: "Still pending.",
        submittedAt: "2026-06-16T09:20:00.000Z"
      })
    ).toThrow(expect.objectContaining({ code: "UNPROCESSABLE_STATE" }));
  });
});
