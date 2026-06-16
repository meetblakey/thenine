import { describe, expect, it } from "vitest";
import * as contracts from "./index.js";

type LaunchpadModule = {
  LAUNCHPAD_BLOCKERS?: readonly string[];
  LAUNCHPAD_ROUTE_CONTRACT?: {
    method: string;
    path: string;
    auth: string;
    scope: string;
    requestFields: readonly string[];
    responseFields: readonly string[];
    forbiddenResponseFields: readonly string[];
    safetyActions: readonly string[];
  };
  assertLaunchpadContract?: () => void;
};

const launchpad = contracts as LaunchpadModule;

describe("Launchpad API contract", () => {
  it("defines a member-authenticated group readiness route without dating inventory", () => {
    expect(launchpad.LAUNCHPAD_ROUTE_CONTRACT).toMatchObject({
      method: "GET",
      path: "/v1/launchpad",
      auth: "Member JWT",
      scope: "member_acted_group_readiness",
      requestFields: []
    });

    expect(launchpad.LAUNCHPAD_ROUTE_CONTRACT?.responseFields).toEqual(
      expect.arrayContaining([
        "memberId",
        "activeGroupId",
        "readinessStatus",
        "blockers",
        "primaryAction",
        "secondaryActions",
        "safetyActions",
        "refreshesAt"
      ])
    );
    expect(launchpad.LAUNCHPAD_ROUTE_CONTRACT?.forbiddenResponseFields).toEqual(
      expect.arrayContaining([
        "introductions",
        "memberInventory",
        "recipientMemberId",
        "compatibilityScore",
        "reliabilityScore",
        "providerFailureReason",
        "reportNarrative"
      ])
    );
  });

  it("locks exact readiness blockers and one-tap safety actions", () => {
    expect(launchpad.LAUNCHPAD_BLOCKERS).toEqual([
      "verification_required",
      "create_or_join_group",
      "invite_pending",
      "profile_required",
      "availability_required",
      "publish_approval_required",
      "moderation_required",
      "safety_paused",
      "eligible_for_first_introduction",
      "thin_city_no_inventory"
    ]);

    expect(launchpad.LAUNCHPAD_ROUTE_CONTRACT?.safetyActions).toEqual([
      "report",
      "block",
      "leave",
      "urgent_help",
      "share_plan"
    ]);
  });

  it("validates Launchpad cannot expose member-scoped inventory or private score fields", () => {
    expect(launchpad.assertLaunchpadContract).toBeTypeOf("function");
    expect(() => launchpad.assertLaunchpadContract?.()).not.toThrow();
  });
});
