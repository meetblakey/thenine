import { computeGroupAvailabilityMesh, assertNoRawCalendarContent } from "@thenine/domain/availability-mesh";
import type { AvailabilityWindowInput, GroupAvailabilityMeshResult, MemberAvailabilityInput } from "@thenine/domain/availability-mesh";
import { ApiRouteError } from "./launchpad-route.js";

export const GET_AVAILABILITY_MESH_ROUTE = {
  method: "GET",
  path: "/v1/groups/{groupId}/availability-mesh",
  auth: "Group member"
} as const;

export const PUT_AVAILABILITY_WINDOWS_ROUTE = {
  method: "PUT",
  path: "/v1/groups/{groupId}/availability-windows",
  auth: "Group member",
  requiresIdempotencyKey: true
} as const;

export interface AvailabilityMember {
  memberId: string;
  memberStatus: "active" | "suspended" | "banned" | "deleted";
  verificationStatus: "approved";
}

export interface AvailabilityContext {
  member: AvailabilityMember | null;
  idempotencyKey: string | null;
}

export interface AvailabilityRouteDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  loadActiveMemberIdsForGroup: (groupId: string) => Promise<string[]>;
  loadMemberAvailabilityWindows: (groupId: string) => Promise<MemberAvailabilityInput[]>;
  persistMemberAvailabilityWindows: (input: {
    groupId: string;
    memberId: string;
    windows: AvailabilityWindowInput[];
  }) => Promise<{ sourceEventId: string; computedAt: string }>;
  saveGroupAvailabilityMesh: (mesh: GroupAvailabilityMeshResult & { sourceEventId?: string }) => Promise<GroupAvailabilityMeshResult & { sourceEventId?: string }>;
}

export interface PutAvailabilityWindowsBody {
  memberId: string;
  windows: AvailabilityWindowInput[];
}

export async function handleGetAvailabilityMesh(
  context: AvailabilityContext,
  params: { groupId: string },
  dependencies: AvailabilityRouteDependencies
): Promise<GroupAvailabilityMeshResult> {
  const member = requireAvailabilityMember(context.member);
  await dependencies.assertGroupMemberAccess(params.groupId, member.memberId);

  return loadComputedMesh(params.groupId, new Date().toISOString(), dependencies);
}

export async function handlePutAvailabilityWindows(
  context: AvailabilityContext,
  params: { groupId: string },
  body: PutAvailabilityWindowsBody & Record<string, unknown>,
  dependencies: AvailabilityRouteDependencies
): Promise<GroupAvailabilityMeshResult & { sourceEventId: string }> {
  const member = requireAvailabilityMember(context.member);
  requireIdempotency(context);
  await dependencies.reserveIdempotencyKey(
    `${PUT_AVAILABILITY_WINDOWS_ROUTE.method} ${PUT_AVAILABILITY_WINDOWS_ROUTE.path}`,
    context.idempotencyKey,
    member.memberId
  );
  await dependencies.assertGroupMemberAccess(params.groupId, member.memberId);

  if (body.memberId !== member.memberId) {
    throw new ApiRouteError("FORBIDDEN", "Members can update only their own availability windows.");
  }

  try {
    assertNoRawCalendarContent(body);
  } catch (error) {
    throw new ApiRouteError("VALIDATION_ERROR", error instanceof Error ? error.message : "Raw calendar event content is not allowed.");
  }

  const persisted = await dependencies.persistMemberAvailabilityWindows({
    groupId: params.groupId,
    memberId: member.memberId,
    windows: body.windows
  });
  const mesh = await loadComputedMesh(params.groupId, persisted.computedAt, dependencies);
  const savedMesh = await dependencies.saveGroupAvailabilityMesh({
    ...mesh,
    sourceEventId: persisted.sourceEventId
  });

  return {
    ...savedMesh,
    sourceEventId: persisted.sourceEventId
  };
}

function requireAvailabilityMember(member: AvailabilityMember | null): AvailabilityMember {
  if (member === null) {
    throw new ApiRouteError("UNAUTHENTICATED", "Availability routes require a member session.");
  }

  return member;
}

function requireIdempotency(context: AvailabilityContext): asserts context is AvailabilityContext & { idempotencyKey: string } {
  if (context.idempotencyKey === null || context.idempotencyKey.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Mutating routes require Idempotency-Key.");
  }
}

async function loadComputedMesh(
  groupId: string,
  computedAt: string,
  dependencies: AvailabilityRouteDependencies
): Promise<GroupAvailabilityMeshResult> {
  const [activeMemberIds, memberWindows] = await Promise.all([
    dependencies.loadActiveMemberIdsForGroup(groupId),
    dependencies.loadMemberAvailabilityWindows(groupId)
  ]);

  return computeGroupAvailabilityMesh({
    groupId,
    activeMemberIds,
    memberWindows,
    computedAt
  });
}
