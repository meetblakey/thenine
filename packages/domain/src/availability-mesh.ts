import { validateCalendarImportPersistable } from "./invariants.js";

export interface AvailabilityWindowInput {
  startsAt: string;
  endsAt: string;
  timezone: string;
}

export interface MemberAvailabilityInput {
  memberId: string;
  windows: AvailabilityWindowInput[];
}

export interface GroupAvailabilityMeshInput {
  groupId: string;
  activeMemberIds: string[];
  memberWindows: MemberAvailabilityInput[];
  computedAt: string;
}

export interface GroupAvailabilityWindow {
  startsAt: string;
  endsAt: string;
  timezone: string;
  source: "member_entered";
  confirmedByMemberIds: string[];
}

export interface GroupAvailabilityMeshResult {
  groupId: string;
  complete: boolean;
  missingMemberIds: string[];
  overlapWindows: GroupAvailabilityWindow[];
  computedAt: string;
}

interface Interval {
  startsAtMs: number;
  endsAtMs: number;
  timezone: string;
}

export function computeGroupAvailabilityMesh(input: GroupAvailabilityMeshInput): GroupAvailabilityMeshResult {
  const windowsByMemberId = new Map(input.memberWindows.map((memberAvailability) => [memberAvailability.memberId, memberAvailability.windows]));
  const missingMemberIds = input.activeMemberIds.filter((memberId) => (windowsByMemberId.get(memberId)?.length ?? 0) === 0);

  if (missingMemberIds.length > 0 || input.activeMemberIds.length === 0) {
    return {
      groupId: input.groupId,
      complete: false,
      missingMemberIds,
      overlapWindows: [],
      computedAt: input.computedAt
    };
  }

  const [firstMemberId, ...remainingMemberIds] = input.activeMemberIds;
  const firstMemberWindows = firstMemberId === undefined ? [] : toIntervals(windowsByMemberId.get(firstMemberId) ?? []);
  let overlapIntervals = firstMemberWindows;

  for (const memberId of remainingMemberIds) {
    overlapIntervals = intersectIntervals(overlapIntervals, toIntervals(windowsByMemberId.get(memberId) ?? []));
  }

  return {
    groupId: input.groupId,
    complete: overlapIntervals.length > 0,
    missingMemberIds: [],
    overlapWindows: overlapIntervals.map((interval) => ({
      startsAt: new Date(interval.startsAtMs).toISOString(),
      endsAt: new Date(interval.endsAtMs).toISOString(),
      timezone: interval.timezone,
      source: "member_entered",
      confirmedByMemberIds: input.activeMemberIds
    })),
    computedAt: input.computedAt
  };
}

export function assertNoRawCalendarContent(payload: Record<string, unknown>): void {
  validateCalendarImportPersistable(payload);
}

function toIntervals(windows: AvailabilityWindowInput[]): Interval[] {
  return windows.flatMap((window) => {
    const startsAtMs = Date.parse(window.startsAt);
    const endsAtMs = Date.parse(window.endsAt);

    if (Number.isNaN(startsAtMs) || Number.isNaN(endsAtMs) || startsAtMs >= endsAtMs) {
      return [];
    }

    return [
      {
        startsAtMs,
        endsAtMs,
        timezone: window.timezone
      }
    ];
  });
}

function intersectIntervals(leftIntervals: Interval[], rightIntervals: Interval[]): Interval[] {
  const intersections: Interval[] = [];

  for (const left of leftIntervals) {
    for (const right of rightIntervals) {
      const startsAtMs = Math.max(left.startsAtMs, right.startsAtMs);
      const endsAtMs = Math.min(left.endsAtMs, right.endsAtMs);

      if (startsAtMs < endsAtMs) {
        intersections.push({
          startsAtMs,
          endsAtMs,
          timezone: left.timezone
        });
      }
    }
  }

  return intersections;
}
