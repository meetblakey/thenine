import { describe, expect, it } from "vitest";
import * as groupFormation from "./group-formation.js";

interface GroupProfileUpdateMembership {
  memberId: string;
  role: "creator" | "member";
  status: "active" | "left";
  verificationStatus: "approved";
  publishApprovedAt: string | null;
}

interface AvailabilityWindow {
  startsAt: string;
  endsAt: string;
  timezone: string;
}

interface GroupProfileUpdateDraft {
  id: string;
  cityId: string;
  format: "quartet" | "social_pod";
  status: "draft" | "pending_member" | "pending_publish_approval" | "eligible" | "paused" | "ineligible" | "dissolved";
  createdByMemberId: string;
  name: string | null;
  intent: string | null;
  neighborhoodIds?: string[];
  availabilityWindows?: AvailabilityWindow[];
  publishApprovedAt?: string | null;
  visibilityPreviewHash?: string | null;
  memberships: GroupProfileUpdateMembership[];
}

interface GroupProfileUpdateResult {
  group: GroupProfileUpdateDraft;
  outboxEvents: Array<{
    aggregateType: "group";
    aggregateId: string;
    eventName: string;
    eventVersion: 1;
    payload: Record<string, unknown>;
  }>;
}

type GroupProfileUpdateExports = typeof groupFormation & {
  updateGroupProfile?: (input: {
    group: GroupProfileUpdateDraft;
    memberId: string;
    patch: {
      name?: string;
      intent?: string;
      neighborhoodIds?: string[];
      availabilityWindows?: AvailabilityWindow[];
    };
    visibilityPreviewHash: string;
    updatedAt: string;
  }) => GroupProfileUpdateResult;
};

const groupProfileUpdate = groupFormation as GroupProfileUpdateExports;

const eligibleGroup = (): GroupProfileUpdateDraft => ({
  id: "group_1",
  cityId: "city_1",
  format: "quartet",
  status: "eligible",
  createdByMemberId: "member_1",
  name: "Sunday Table",
  intent: "serious",
  neighborhoodIds: ["neighborhood_1"],
  availabilityWindows: [{ startsAt: "2026-06-20T09:00:00.000Z", endsAt: "2026-06-20T11:00:00.000Z", timezone: "Australia/Sydney" }],
  publishApprovedAt: "2026-06-15T10:05:00.000Z",
  visibilityPreviewHash: "preview_hash_1",
  memberships: [
    {
      memberId: "member_1",
      role: "creator",
      status: "active",
      verificationStatus: "approved",
      publishApprovedAt: "2026-06-15T10:00:00.000Z"
    },
    {
      memberId: "member_2",
      role: "member",
      status: "active",
      verificationStatus: "approved",
      publishApprovedAt: "2026-06-15T10:05:00.000Z"
    }
  ]
});

describe("group profile update domain", () => {
  it("updates visible setup fields and resets publish approvals to require a new preview", () => {
    expect(groupProfileUpdate.updateGroupProfile).toBeTypeOf("function");

    const result = groupProfileUpdate.updateGroupProfile?.({
      group: eligibleGroup(),
      memberId: "member_1",
      patch: {
        name: "Friday Friends",
        intent: "relationship",
        neighborhoodIds: ["neighborhood_2"],
        availabilityWindows: [
          { startsAt: "2026-06-21T09:00:00.000Z", endsAt: "2026-06-21T11:00:00.000Z", timezone: "Australia/Sydney" }
        ]
      },
      visibilityPreviewHash: "preview_hash_2",
      updatedAt: "2026-06-16T09:00:00.000Z"
    });

    expect(result?.group).toMatchObject({
      id: "group_1",
      status: "pending_publish_approval",
      name: "Friday Friends",
      intent: "relationship",
      neighborhoodIds: ["neighborhood_2"],
      publishApprovedAt: null,
      visibilityPreviewHash: "preview_hash_2",
      memberships: [
        { memberId: "member_1", publishApprovedAt: null },
        { memberId: "member_2", publishApprovedAt: null }
      ]
    });
    expect(result?.outboxEvents).toEqual([
      {
        aggregateType: "group",
        aggregateId: "group_1",
        eventName: "group.profile_updated",
        eventVersion: 1,
        payload: {
          groupId: "group_1",
          updatedByMemberId: "member_1",
          visibilityPreviewHash: "preview_hash_2",
          fieldsChanged: ["name", "intent", "neighborhoodIds", "availabilityWindows"]
        }
      },
      {
        aggregateType: "group",
        aggregateId: "group_1",
        eventName: "group.eligibility_changed",
        eventVersion: 1,
        payload: {
          groupId: "group_1",
          status: "pending_publish_approval",
          eligibilityStatus: "ineligible",
          blockers: ["publish_approval_required"]
        }
      }
    ]);
    expect(JSON.stringify(result?.outboxEvents)).not.toMatch(/Friday Friends|relationship|neighborhood_2/i);
  });

  it("rejects profile updates from non-active members and invalid availability windows", () => {
    expect(() =>
      groupProfileUpdate.updateGroupProfile?.({
        group: eligibleGroup(),
        memberId: "member_3",
        patch: { name: "Friday Friends" },
        visibilityPreviewHash: "preview_hash_2",
        updatedAt: "2026-06-16T09:00:00.000Z"
      })
    ).toThrow(expect.objectContaining({ code: "GROUP_ACCESS_DENIED" }));

    expect(() =>
      groupProfileUpdate.updateGroupProfile?.({
        group: eligibleGroup(),
        memberId: "member_1",
        patch: {
          availabilityWindows: [
            { startsAt: "2026-06-21T11:00:00.000Z", endsAt: "2026-06-21T09:00:00.000Z", timezone: "Australia/Sydney" }
          ]
        },
        visibilityPreviewHash: "preview_hash_2",
        updatedAt: "2026-06-16T09:00:00.000Z"
      })
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });
});
