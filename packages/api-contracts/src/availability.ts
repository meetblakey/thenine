import { ContractInvariantError } from "./route-invariants.js";

export interface AvailabilityRouteContract {
  method: "GET" | "PUT";
  path: string;
  auth: "Group member";
  ownerScope: "group";
  requiresIdempotencyKey: boolean;
  requestFields: readonly string[];
  responseFields: readonly string[];
  forbiddenRequestFields: readonly string[];
  forbiddenResponseFields: readonly string[];
}

const forbiddenCalendarRequestFields = ["eventTitle", "attendees", "notes", "links", "location", "rawCalendarContent"] as const;
const forbiddenAvailabilityResponseFields = [
  "memberInventory",
  "calendarEventTitle",
  "calendarAttendees",
  "compatibilityScore",
  "reliabilityScore"
] as const;

export const AVAILABILITY_ROUTE_CONTRACTS: readonly AvailabilityRouteContract[] = [
  {
    method: "GET",
    path: "/v1/groups/{groupId}/availability-mesh",
    auth: "Group member",
    ownerScope: "group",
    requiresIdempotencyKey: false,
    requestFields: [],
    responseFields: ["groupId", "complete", "missingMemberIds", "overlapWindows", "computedAt"],
    forbiddenRequestFields: forbiddenCalendarRequestFields,
    forbiddenResponseFields: forbiddenAvailabilityResponseFields
  },
  {
    method: "PUT",
    path: "/v1/groups/{groupId}/availability-windows",
    auth: "Group member",
    ownerScope: "group",
    requiresIdempotencyKey: true,
    requestFields: ["memberId", "windows"],
    responseFields: ["groupId", "complete", "missingMemberIds", "overlapWindows", "computedAt"],
    forbiddenRequestFields: forbiddenCalendarRequestFields,
    forbiddenResponseFields: forbiddenAvailabilityResponseFields
  }
];

export function assertAvailabilityContracts(routes: readonly AvailabilityRouteContract[] = AVAILABILITY_ROUTE_CONTRACTS): void {
  const updateRoute = routes.find((route) => route.path === "/v1/groups/{groupId}/availability-windows");

  if (updateRoute === undefined || updateRoute.requiresIdempotencyKey !== true) {
    throw new ContractInvariantError(
      "AVAILABILITY_MUTATION_IDEMPOTENCY_REQUIRED",
      "Availability window updates must require Idempotency-Key."
    );
  }

  const hasRawCalendarField = routes.some((route) => {
    const forbiddenFields = new Set<string>(route.forbiddenRequestFields);

    return ["eventTitle", "attendees", "notes", "links", "location", "rawCalendarContent"].some((field) => forbiddenFields.has(field));
  });

  if (!hasRawCalendarField) {
    throw new ContractInvariantError(
      "AVAILABILITY_RAW_CALENDAR_GUARD_REQUIRED",
      "Availability contracts must explicitly reject raw calendar event content."
    );
  }

  const exposesPrivateField = routes.some((route) => {
    const forbiddenFields = new Set<string>(route.forbiddenResponseFields);

    return ["memberInventory", "compatibilityScore", "reliabilityScore"].some((field) => !forbiddenFields.has(field));
  });

  if (exposesPrivateField) {
    throw new ContractInvariantError(
      "AVAILABILITY_PRIVATE_RESPONSE_GUARD_REQUIRED",
      "Availability mesh responses must not expose member inventory or ranking-only scores."
    );
  }
}
