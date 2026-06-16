import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";
import type { PlanResource } from "@thenine/domain";

interface AuthenticatedMember {
  memberId: string;
}

interface PlanMutationContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

interface PlanShareDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadPlanShareAccess: (planId: string, memberId: string) => Promise<{ plan: PlanResource }>;
  nextShareId: () => string;
  hashContactChannel: (contactChannel: string) => string;
  now: () => Date;
  persistTrustedContactPlanShare: (input: Record<string, unknown>) => Promise<{ id: string; deliveryStatus: "queued" | "sent" }>;
}

type PlanApiExports = typeof api & {
  POST_PLAN_SHARE_ROUTE?: {
    method: string;
    path: string;
    auth: string;
    requiresIdempotencyKey: boolean;
  };
  handlePostPlanShare?: (
    context: PlanMutationContext,
    params: { planId: string },
    body: { contactLabel: string; contactChannel: string },
    dependencies: PlanShareDependencies
  ) => Promise<{ shareId: string; deliveryStatus: "queued" | "sent" }>;
};

const planApi = api as PlanApiExports;
const member: AuthenticatedMember = {
  memberId: "member_a"
};

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

describe("Plan share API route", () => {
  it("publishes documented Plan share route metadata", () => {
    expect(planApi.POST_PLAN_SHARE_ROUTE).toEqual({
      method: "POST",
      path: "/v1/plans/{planId}/share",
      auth: "Plan participant",
      requiresIdempotencyKey: true
    });
  });

  it("hashes contact channels before persisting the queued Plan share", async () => {
    expect(planApi.handlePostPlanShare).toBeTypeOf("function");

    const calls: string[] = [];
    const persistTrustedContactPlanShare = vi.fn(async (input: Record<string, unknown>) => {
      void input;
      calls.push("persist-share");

      return { id: "share_1", deliveryStatus: "queued" as const };
    });

    const result = await planApi.handlePostPlanShare?.(
      { member, idempotencyKey: "idem-share" },
      { planId: "plan_1" },
      { contactLabel: "Sam", contactChannel: "sam@example.com" },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        loadPlanShareAccess: vi.fn(async () => {
          calls.push("access");

          return { plan: confirmedPlan() };
        }),
        nextShareId: () => "share_1",
        hashContactChannel: (contactChannel: string) => {
          calls.push("hash-contact");

          return `hash:${contactChannel}`;
        },
        now: () => new Date("2026-06-20T10:10:00.000Z"),
        persistTrustedContactPlanShare
      }
    );

    expect(calls).toEqual(["idempotency", "access", "hash-contact", "persist-share"]);
    expect(result).toEqual({ shareId: "share_1", deliveryStatus: "queued" });
    expect(persistTrustedContactPlanShare).toHaveBeenCalledWith({
      share: {
        id: "share_1",
        planId: "plan_1",
        memberId: "member_a",
        contactLabel: "Sam",
        contactChannelHash: "hash:sam@example.com",
        deliveryStatus: "queued",
        sharedAt: "2026-06-20T10:10:00.000Z"
      }
    });
    expect(JSON.stringify(persistTrustedContactPlanShare.mock.calls[0]?.[0])).not.toContain("\"contactChannel\"");
  });

  it("requires idempotency before sharing Plans", async () => {
    await expect(
      planApi.handlePostPlanShare?.(
        { member, idempotencyKey: null },
        { planId: "plan_1" },
        { contactLabel: "Sam", contactChannel: "sam@example.com" },
        {
          reserveIdempotencyKey: vi.fn(),
          loadPlanShareAccess: vi.fn(),
          nextShareId: () => "share_1",
          hashContactChannel: (contactChannel: string) => contactChannel,
          now: () => new Date("2026-06-20T10:10:00.000Z"),
          persistTrustedContactPlanShare: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
