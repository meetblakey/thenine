import { describe, expect, it } from "vitest";
import * as groupFormation from "./group-formation.js";

interface GroupReadMembership {
  memberId: string;
  role: "creator" | "member";
  status: "invited" | "active" | "left";
  verificationStatus: "approved";
  publishApprovedAt: string | null;
}

interface GroupReadDraft {
  id: string;
  cityId: string;
  format: "quartet" | "social_pod";
  status: "pending_member" | "pending_publish_approval" | "eligible" | "paused" | "ineligible" | "dissolved";
  createdByMemberId: string;
  name: string | null;
  intent: string | null;
  neighborhoodIds?: string[];
  availabilityWindows?: Array<{ startsAt: string; endsAt: string; timezone: string }>;
  eligibilityStatus?: "eligible" | "ineligible";
  eligibilityBlockers?: string[];
  memberships: GroupReadMembership[];
}

interface GroupResource {
  id: string;
  cityId: string;
  format: string;
  status: string;
  name: string | null;
  intent: string | null;
  neighborhoodIds: string[];
  availabilityWindows: Array<{ startsAt: string; endsAt: string; timezone: string }>;
  eligibilityStatus: "eligible" | "ineligible";
  eligibilityBlockers: string[];
  members: Array<{ memberId: string; role: string; status: string; verificationStatus: string; publishApprovedAt: string | null }>;
}

type GroupReadExports = typeof groupFormation & {
  buildGroupResourceForMember?: (input: { group: GroupReadDraft; viewerMemberId: string }) => GroupResource;
};

const groupReadDomain = groupFormation as GroupReadExports;

const groupWithPendingInvite = (): GroupReadDraft => ({
  id: "group_1",
  cityId: "city_1",
  format: "quartet",
  status: "pending_member",
  createdByMemberId: "member_1",
  name: "Sunday Table",
  intent: "serious",
  neighborhoodIds: ["neighborhood_1"],
  availabilityWindows: [{ startsAt: "2026-06-20T09:00:00.000Z", endsAt: "2026-06-20T11:00:00.000Z", timezone: "Australia/Sydney" }],
  eligibilityStatus: "ineligible",
  eligibilityBlockers: ["quartet_requires_two_active_verified_members"],
  memberships: [
    {
      memberId: "member_1",
      role: "creator",
      status: "active",
      verificationStatus: "approved",
      publishApprovedAt: null
    },
    {
      memberId: "member_2",
      role: "member",
      status: "invited",
      verificationStatus: "approved",
      publishApprovedAt: null
    }
  ]
});

describe("group read resources", () => {
  it("serializes a group for an active member without exposing non-consented invitees", () => {
    expect(groupReadDomain.buildGroupResourceForMember).toBeTypeOf("function");

    const resource = groupReadDomain.buildGroupResourceForMember?.({
      group: groupWithPendingInvite(),
      viewerMemberId: "member_1"
    });

    expect(resource).toEqual({
      id: "group_1",
      cityId: "city_1",
      format: "quartet",
      status: "pending_member",
      name: "Sunday Table",
      intent: "serious",
      neighborhoodIds: ["neighborhood_1"],
      availabilityWindows: [{ startsAt: "2026-06-20T09:00:00.000Z", endsAt: "2026-06-20T11:00:00.000Z", timezone: "Australia/Sydney" }],
      eligibilityStatus: "ineligible",
      eligibilityBlockers: ["quartet_requires_two_active_verified_members"],
      members: [
        {
          memberId: "member_1",
          role: "creator",
          status: "active",
          verificationStatus: "approved",
          publishApprovedAt: null
        }
      ]
    });
    expect(JSON.stringify(resource)).not.toContain("member_2");
  });

  it("denies group draft reads to non-active members and invited members", () => {
    expect(() =>
      groupReadDomain.buildGroupResourceForMember?.({
        group: groupWithPendingInvite(),
        viewerMemberId: "member_2"
      })
    ).toThrow(expect.objectContaining({ code: "GROUP_ACCESS_DENIED" }));

    expect(() =>
      groupReadDomain.buildGroupResourceForMember?.({
        group: groupWithPendingInvite(),
        viewerMemberId: "member_3"
      })
    ).toThrow(expect.objectContaining({ code: "GROUP_ACCESS_DENIED" }));
  });
});
