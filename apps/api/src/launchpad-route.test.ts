import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";

type VerificationStatus = "not_started" | "pending" | "retry_required" | "approved" | "rejected" | "appeal_pending";

interface AuthenticatedMember {
  memberId: string;
  verificationStatus: VerificationStatus;
}

interface ApiLaunchpadDependencies {
  loadActiveGroupForMember: (memberId: string) => Promise<unknown | null>;
  hasQualifiedIntroductionsForGroup: (groupId: string) => Promise<boolean>;
  getNextIntroductionRefreshAt: (groupId: string) => Promise<string | null>;
}

type ApiExports = typeof api & {
  GET_LAUNCHPAD_ROUTE?: { method: string; path: string; auth: string };
  handleGetLaunchpad?: (
    context: { member: AuthenticatedMember | null },
    dependencies: ApiLaunchpadDependencies
  ) => Promise<Record<string, unknown>>;
};

const launchpadApi = api as ApiExports;

const activeGroup = {
  groupId: "group_quartet_1",
  format: "quartet",
  groupStatus: "pending_publish_approval",
  name: "Sunday Table",
  intent: "serious",
  neighborhoodIds: ["neighborhood_1"],
  availabilityWindows: [
    { startsAt: "2026-06-20T09:00:00.000Z", endsAt: "2026-06-20T11:00:00.000Z", timezone: "Australia/Sydney" }
  ],
  profile: {
    sharedVibe: "low-key dinners and sharp conversation",
    memberCardsComplete: true,
    moderationStatus: "approved"
  },
  memberships: [
    {
      memberId: "member_1",
      membershipStatus: "active",
      memberStatus: "active",
      verificationStatus: "approved",
      publishApprovedAt: "2026-06-16T00:00:00.000Z"
    },
    {
      memberId: "member_2",
      membershipStatus: "active",
      memberStatus: "active",
      verificationStatus: "approved",
      publishApprovedAt: "2026-06-16T00:00:00.000Z"
    }
  ],
  safetyPaused: false
};

describe("GET /v1/launchpad API route", () => {
  it("publishes route metadata that matches the documented Launchpad contract", () => {
    expect(launchpadApi.GET_LAUNCHPAD_ROUTE).toEqual({
      method: "GET",
      path: "/v1/launchpad",
      auth: "Member JWT"
    });
  });

  it("rejects requests without a member session", async () => {
    expect(launchpadApi.handleGetLaunchpad).toBeTypeOf("function");

    await expect(
      launchpadApi.handleGetLaunchpad?.(
        { member: null },
        {
          loadActiveGroupForMember: vi.fn(),
          hasQualifiedIntroductionsForGroup: vi.fn(),
          getNextIntroductionRefreshAt: vi.fn()
        }
      )
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED"
    });
  });

  it("returns group readiness without member-scoped inventory or private ranking scores", async () => {
    expect(launchpadApi.handleGetLaunchpad).toBeTypeOf("function");

    const result = await launchpadApi.handleGetLaunchpad?.(
      { member: { memberId: "member_1", verificationStatus: "approved" } },
      {
        loadActiveGroupForMember: vi.fn(async () => activeGroup),
        hasQualifiedIntroductionsForGroup: vi.fn(async () => true),
        getNextIntroductionRefreshAt: vi.fn(async () => "2026-06-20T12:00:00.000Z")
      }
    );

    expect(result).toMatchObject({
      memberId: "member_1",
      activeGroupId: "group_quartet_1",
      readinessStatus: "eligible",
      blockers: ["eligible_for_first_introduction"],
      primaryAction: { kind: "open_first_introduction", groupId: "group_quartet_1" }
    });

    for (const forbiddenField of ["introductions", "memberInventory", "recipientMemberId", "compatibilityScore", "reliabilityScore"]) {
      expect(result).not.toHaveProperty(forbiddenField);
    }
  });
});
