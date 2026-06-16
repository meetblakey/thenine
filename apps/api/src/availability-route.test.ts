import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";

interface AuthenticatedMember {
  memberId: string;
  memberStatus: "active" | "suspended" | "banned" | "deleted";
  verificationStatus: "approved";
}

interface AvailabilityContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

interface AvailabilityWindow {
  startsAt: string;
  endsAt: string;
  timezone: string;
}

interface AvailabilityRouteDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  loadActiveMemberIdsForGroup: (groupId: string) => Promise<string[]>;
  loadMemberAvailabilityWindows: (groupId: string) => Promise<Array<{ memberId: string; windows: AvailabilityWindow[] }>>;
  persistMemberAvailabilityWindows: (input: {
    groupId: string;
    memberId: string;
    windows: AvailabilityWindow[];
  }) => Promise<{ sourceEventId: string; computedAt: string }>;
  saveGroupAvailabilityMesh: (mesh: unknown & { sourceEventId?: string }) => Promise<unknown>;
}

type AvailabilityApiExports = typeof api & {
  GET_AVAILABILITY_MESH_ROUTE?: { method: string; path: string; auth: string };
  PUT_AVAILABILITY_WINDOWS_ROUTE?: { method: string; path: string; auth: string; requiresIdempotencyKey: boolean };
  handleGetAvailabilityMesh?: (
    context: AvailabilityContext,
    params: { groupId: string },
    dependencies: AvailabilityRouteDependencies
  ) => Promise<Record<string, unknown>>;
  handlePutAvailabilityWindows?: (
    context: AvailabilityContext,
    params: { groupId: string },
    body: { memberId: string; windows: AvailabilityWindow[]; eventTitle?: string },
    dependencies: AvailabilityRouteDependencies
  ) => Promise<Record<string, unknown>>;
};

const availabilityApi = api as AvailabilityApiExports;
const member: AuthenticatedMember = {
  memberId: "member_1",
  memberStatus: "active",
  verificationStatus: "approved"
};

describe("availability mesh API routes", () => {
  it("publishes group-scoped route metadata", () => {
    expect(availabilityApi.GET_AVAILABILITY_MESH_ROUTE).toEqual({
      method: "GET",
      path: "/v1/groups/{groupId}/availability-mesh",
      auth: "Group member"
    });
    expect(availabilityApi.PUT_AVAILABILITY_WINDOWS_ROUTE).toEqual({
      method: "PUT",
      path: "/v1/groups/{groupId}/availability-windows",
      auth: "Group member",
      requiresIdempotencyKey: true
    });
  });

  it("reads a persisted group mesh only after group access is confirmed", async () => {
    expect(availabilityApi.handleGetAvailabilityMesh).toBeTypeOf("function");

    const result = await availabilityApi.handleGetAvailabilityMesh?.(
      { member, idempotencyKey: null },
      { groupId: "group_1" },
      {
        reserveIdempotencyKey: vi.fn(),
        assertGroupMemberAccess: vi.fn(async () => undefined),
        loadActiveMemberIdsForGroup: vi.fn(async () => ["member_1", "member_2"]),
        loadMemberAvailabilityWindows: vi.fn(async () => [
          {
            memberId: "member_1",
            windows: [
              { startsAt: "2026-06-20T09:00:00.000Z", endsAt: "2026-06-20T12:00:00.000Z", timezone: "Australia/Sydney" }
            ]
          },
          {
            memberId: "member_2",
            windows: [
              { startsAt: "2026-06-20T10:00:00.000Z", endsAt: "2026-06-20T13:00:00.000Z", timezone: "Australia/Sydney" }
            ]
          }
        ]),
        persistMemberAvailabilityWindows: vi.fn(),
        saveGroupAvailabilityMesh: vi.fn()
      }
    );

    expect(result).toMatchObject({
      groupId: "group_1",
      complete: true,
      overlapWindows: [{ startsAt: "2026-06-20T10:00:00.000Z", endsAt: "2026-06-20T12:00:00.000Z" }]
    });
    expect(result).not.toHaveProperty("calendarEventTitle");
  });

  it("persists member windows before saving the recomputed group mesh", async () => {
    expect(availabilityApi.handlePutAvailabilityWindows).toBeTypeOf("function");

    const calls: string[] = [];
    const result = await availabilityApi.handlePutAvailabilityWindows?.(
      { member, idempotencyKey: "idem-availability" },
      { groupId: "group_1" },
      {
        memberId: "member_1",
        windows: [
          { startsAt: "2026-06-20T09:00:00.000Z", endsAt: "2026-06-20T12:00:00.000Z", timezone: "Australia/Sydney" }
        ]
      },
      {
        reserveIdempotencyKey: vi.fn(async () => {
          calls.push("idempotency");
        }),
        assertGroupMemberAccess: vi.fn(async () => {
          calls.push("access");
        }),
        persistMemberAvailabilityWindows: vi.fn(async () => {
          calls.push("persist-windows");

          return { sourceEventId: "event_1", computedAt: "2026-06-16T12:00:00.000Z" };
        }),
        loadActiveMemberIdsForGroup: vi.fn(async () => ["member_1"]),
        loadMemberAvailabilityWindows: vi.fn(async () => [
          {
            memberId: "member_1",
            windows: [
              { startsAt: "2026-06-20T09:00:00.000Z", endsAt: "2026-06-20T12:00:00.000Z", timezone: "Australia/Sydney" }
            ]
          }
        ]),
        saveGroupAvailabilityMesh: vi.fn(async (mesh: unknown) => {
          calls.push("save-mesh");

          return mesh;
        })
      }
    );

    expect(calls).toEqual(["idempotency", "access", "persist-windows", "save-mesh"]);
    expect(result).toMatchObject({ groupId: "group_1", complete: true, sourceEventId: "event_1" });
  });

  it("rejects raw calendar content on P0 availability updates", async () => {
    await expect(
      availabilityApi.handlePutAvailabilityWindows?.(
        { member, idempotencyKey: "idem-availability" },
        { groupId: "group_1" },
        {
          memberId: "member_1",
          eventTitle: "Dinner with Alex",
          windows: [
            { startsAt: "2026-06-20T09:00:00.000Z", endsAt: "2026-06-20T12:00:00.000Z", timezone: "Australia/Sydney" }
          ]
        },
        {
          reserveIdempotencyKey: vi.fn(async () => undefined),
          assertGroupMemberAccess: vi.fn(async () => undefined),
          loadActiveMemberIdsForGroup: vi.fn(),
          loadMemberAvailabilityWindows: vi.fn(),
          persistMemberAvailabilityWindows: vi.fn(),
          saveGroupAvailabilityMesh: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
