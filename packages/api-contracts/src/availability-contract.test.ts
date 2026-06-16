import { describe, expect, it } from "vitest";
import * as contracts from "./index.js";

type AvailabilityModule = {
  AVAILABILITY_ROUTE_CONTRACTS?: ReadonlyArray<{
    method: string;
    path: string;
    auth: string;
    ownerScope: string;
    requiresIdempotencyKey: boolean;
    requestFields: readonly string[];
    responseFields: readonly string[];
    forbiddenRequestFields: readonly string[];
    forbiddenResponseFields: readonly string[];
  }>;
  assertAvailabilityContracts?: () => void;
};

const availabilityContracts = contracts as unknown as AvailabilityModule;

describe("Availability Mesh API contracts", () => {
  it("defines group-scoped mesh read and window update routes", () => {
    expect(availabilityContracts.AVAILABILITY_ROUTE_CONTRACTS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "GET",
          path: "/v1/groups/{groupId}/availability-mesh",
          auth: "Group member",
          ownerScope: "group",
          requiresIdempotencyKey: false
        }),
        expect.objectContaining({
          method: "PUT",
          path: "/v1/groups/{groupId}/availability-windows",
          auth: "Group member",
          ownerScope: "group",
          requiresIdempotencyKey: true
        })
      ])
    );
  });

  it("keeps availability payloads group-level and rejects raw calendar content", () => {
    const updateRoute = availabilityContracts.AVAILABILITY_ROUTE_CONTRACTS?.find(
      (route) => route.path === "/v1/groups/{groupId}/availability-windows"
    );

    expect(updateRoute?.requestFields).toEqual(expect.arrayContaining(["memberId", "windows"]));
    expect(updateRoute?.forbiddenRequestFields).toEqual(
      expect.arrayContaining(["eventTitle", "attendees", "notes", "links", "location", "rawCalendarContent"])
    );

    const meshRoute = availabilityContracts.AVAILABILITY_ROUTE_CONTRACTS?.find(
      (route) => route.path === "/v1/groups/{groupId}/availability-mesh"
    );

    expect(meshRoute?.responseFields).toEqual(
      expect.arrayContaining(["groupId", "complete", "missingMemberIds", "overlapWindows", "computedAt"])
    );
    expect(meshRoute?.forbiddenResponseFields).toEqual(
      expect.arrayContaining(["memberInventory", "calendarEventTitle", "calendarAttendees", "compatibilityScore", "reliabilityScore"])
    );
  });

  it("validates the availability contract guardrails", () => {
    expect(availabilityContracts.assertAvailabilityContracts).toBeTypeOf("function");
    expect(() => availabilityContracts.assertAvailabilityContracts?.()).not.toThrow();
  });
});
