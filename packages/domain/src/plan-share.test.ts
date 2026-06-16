import { describe, expect, it } from "vitest";
import * as domain from "./index.js";
import type { PlanResource } from "./types.js";

interface TrustedContactPlanShareInput {
  shareId: string;
  plan: PlanResource;
  memberId: string;
  contactLabel: string;
  contactChannelHash: string;
  sharedAt: string;
}

interface TrustedContactPlanShareResult {
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

type PlanDomainExports = typeof domain & {
  buildTrustedContactPlanShare?: (input: TrustedContactPlanShareInput) => TrustedContactPlanShareResult;
};

const planDomain = domain as PlanDomainExports;

const confirmedPlan = (): PlanResource => ({
  id: "plan_1",
  format: "quartet",
  status: "confirmed",
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

describe("trusted-contact Plan share domain", () => {
  it("queues a confirmed Plan share without raw contact channels", () => {
    expect(planDomain.buildTrustedContactPlanShare).toBeTypeOf("function");

    const result = planDomain.buildTrustedContactPlanShare?.({
      shareId: "share_1",
      plan: confirmedPlan(),
      memberId: "member_a",
      contactLabel: "Sam",
      contactChannelHash: "hash_channel_1",
      sharedAt: "2026-06-20T10:10:00.000Z"
    });

    expect(result?.share).toEqual({
      id: "share_1",
      planId: "plan_1",
      memberId: "member_a",
      contactLabel: "Sam",
      contactChannelHash: "hash_channel_1",
      deliveryStatus: "queued",
      sharedAt: "2026-06-20T10:10:00.000Z"
    });
    expect(JSON.stringify(result)).not.toContain("sam@example.com");
  });

  it("rejects sharing unconfirmed or venue-less Plans", () => {
    expect(planDomain.buildTrustedContactPlanShare).toBeTypeOf("function");

    expect(() =>
      planDomain.buildTrustedContactPlanShare?.({
        shareId: "share_2",
        plan: { ...confirmedPlan(), status: "rsvp_requested" },
        memberId: "member_a",
        contactLabel: "Sam",
        contactChannelHash: "hash_channel_1",
        sharedAt: "2026-06-20T10:10:00.000Z"
      })
    ).toThrow(/confirmed/i);

    expect(() =>
      planDomain.buildTrustedContactPlanShare?.({
        shareId: "share_3",
        plan: { ...confirmedPlan(), venueName: null, venueId: null },
        memberId: "member_a",
        contactLabel: "Sam",
        contactChannelHash: "hash_channel_1",
        sharedAt: "2026-06-20T10:10:00.000Z"
      })
    ).toThrow(/venue/i);
  });
});
