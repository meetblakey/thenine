import { describe, expect, it, vi } from "vitest";
import * as api from "./index.js";

type ModerationStatus = "not_required" | "pending" | "approved" | "rejected" | "held_for_review";

interface AuthenticatedMember {
  memberId: string;
}

interface GroupProfileMutationContext {
  member: AuthenticatedMember | null;
  idempotencyKey: string | null;
}

interface GroupVouch {
  id: string;
  groupId: string;
  authorMemberId: string;
  subjectMemberId: string;
  body: string;
  subjectApprovedAt: string | null;
  moderationStatus: ModerationStatus;
  hiddenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GroupVouchAccess {
  activeMemberIds: string[];
}

interface PostGroupVouchDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadGroupVouchAccess: (groupId: string, memberId: string) => Promise<GroupVouchAccess>;
  moderateGroupVouch: (input: {
    groupId: string;
    authorMemberId: string;
    subjectMemberId: string;
    body: string;
  }) => Promise<{ status: Extract<ModerationStatus, "approved" | "held_for_review" | "rejected">; reasonCode: string | null }>;
  nextVouchId: () => string;
  now: () => Date;
  persistGroupVouch: (input: Record<string, unknown>) => Promise<GroupVouch>;
}

interface PatchGroupVouchDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  loadGroupVouchUpdateContext: (
    groupId: string,
    vouchId: string,
    memberId: string
  ) => Promise<{ vouch: GroupVouch; activeMemberIds: string[] }>;
  moderateGroupVouch: (input: {
    groupId: string;
    authorMemberId: string;
    subjectMemberId: string;
    body: string;
  }) => Promise<{ status: Extract<ModerationStatus, "approved" | "held_for_review" | "rejected">; reasonCode: string | null }>;
  now: () => Date;
  persistGroupVouchUpdate: (input: Record<string, unknown>) => Promise<GroupVouch>;
}

type GroupProfileApiExports = typeof api & {
  POST_GROUP_VOUCH_ROUTE?: { method: string; path: string; auth: string; requiresIdempotencyKey: boolean };
  PATCH_GROUP_VOUCH_ROUTE?: { method: string; path: string; auth: string; requiresIdempotencyKey: boolean };
  handlePostGroupVouch?: (
    context: GroupProfileMutationContext,
    params: { groupId: string },
    body: { subjectMemberId: string; body: string },
    dependencies: PostGroupVouchDependencies
  ) => Promise<{ id: string; moderationStatus: ModerationStatus; subjectApprovedAt: string | null }>;
  handlePatchGroupVouch?: (
    context: GroupProfileMutationContext,
    params: { groupId: string; vouchId: string },
    body: { body?: string; subjectApproved?: boolean; hidden?: boolean },
    dependencies: PatchGroupVouchDependencies
  ) => Promise<{ id: string; moderationStatus: ModerationStatus; subjectApprovedAt: string | null; hiddenAt: string | null }>;
};

const groupProfileApi = api as GroupProfileApiExports;
const member = { memberId: "member_1" };
const activeMemberIds = ["member_1", "member_2"];

const existingVouch: GroupVouch = {
  id: "vouch_1",
  groupId: "group_1",
  authorMemberId: "member_1",
  subjectMemberId: "member_2",
  body: "Ari keeps plans calm.",
  subjectApprovedAt: null,
  moderationStatus: "approved",
  hiddenAt: null,
  createdAt: "2026-06-20T10:00:00.000Z",
  updatedAt: "2026-06-20T10:00:00.000Z"
};

describe("group profile vouch API routes", () => {
  it("publishes documented vouch route metadata with idempotency", () => {
    expect(groupProfileApi.POST_GROUP_VOUCH_ROUTE).toEqual({
      method: "POST",
      path: "/v1/groups/{groupId}/vouches",
      auth: "Group member",
      requiresIdempotencyKey: true
    });
    expect(groupProfileApi.PATCH_GROUP_VOUCH_ROUTE).toEqual({
      method: "PATCH",
      path: "/v1/groups/{groupId}/vouches/{vouchId}",
      auth: "Group member",
      requiresIdempotencyKey: true
    });
  });

  it("persists an approved vouch with a group outbox event before any display fanout", async () => {
    expect(groupProfileApi.handlePostGroupVouch).toBeTypeOf("function");

    const calls: string[] = [];
    const reserveIdempotencyKey = vi.fn(async () => {
      calls.push("idempotency");
    });
    const persistGroupVouch = vi.fn(async (input: Record<string, unknown>) => {
      calls.push("persist-vouch-with-outbox");

      return input.vouch as GroupVouch;
    });

    const result = await groupProfileApi.handlePostGroupVouch?.(
      { member, idempotencyKey: "idem-vouch" },
      { groupId: "group_1" },
      { subjectMemberId: "member_2", body: "Ari keeps plans calm." },
      {
        reserveIdempotencyKey,
        loadGroupVouchAccess: vi.fn(async () => {
          calls.push("access");

          return { activeMemberIds };
        }),
        moderateGroupVouch: vi.fn(async () => {
          calls.push("moderation");

          return { status: "approved" as const, reasonCode: null };
        }),
        nextVouchId: () => "vouch_1",
        now: () => new Date("2026-06-20T10:00:00.000Z"),
        persistGroupVouch
      }
    );

    expect(calls).toEqual(["idempotency", "access", "moderation", "persist-vouch-with-outbox"]);
    expect(reserveIdempotencyKey).toHaveBeenCalledWith("POST /v1/groups/{groupId}/vouches", "idem-vouch", "member_1");
    expect(result).toEqual({
      id: "vouch_1",
      moderationStatus: "approved",
      subjectApprovedAt: null
    });
    expect(persistGroupVouch).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxEvent: expect.objectContaining({
          aggregateType: "group",
          aggregateId: "group_1",
          eventName: "group.vouch_created"
        })
      })
    );
  });

  it("persists held vouches without leaking private copy into event payloads", async () => {
    expect(groupProfileApi.handlePostGroupVouch).toBeTypeOf("function");

    const persistGroupVouch = vi.fn(async (input: Record<string, unknown>) => input.vouch as GroupVouch);

    await expect(
      groupProfileApi.handlePostGroupVouch?.(
        { member, idempotencyKey: "idem-held-vouch" },
        { groupId: "group_1" },
        { subjectMemberId: "member_2", body: "unsafe private detail" },
        {
          reserveIdempotencyKey: vi.fn(async () => undefined),
          loadGroupVouchAccess: vi.fn(async () => ({ activeMemberIds })),
          moderateGroupVouch: vi.fn(async () => ({ status: "held_for_review" as const, reasonCode: "private_information" })),
          nextVouchId: () => "vouch_held",
          now: () => new Date("2026-06-20T10:05:00.000Z"),
          persistGroupVouch
        }
      )
    ).rejects.toMatchObject({ code: "MESSAGE_MODERATION_HELD" });

    expect(persistGroupVouch).toHaveBeenCalledWith(
      expect.objectContaining({
        outboxEvent: expect.objectContaining({
          eventName: "group.vouch_held",
          payload: expect.objectContaining({
            moderationStatus: "held_for_review",
            reasonCode: "private_information"
          })
        })
      })
    );
    expect(JSON.stringify((persistGroupVouch.mock.calls[0]?.[0] as { outboxEvent?: { payload?: unknown } }).outboxEvent?.payload)).not.toContain(
      "unsafe private detail"
    );
  });

  it("allows the vouch subject to approve visible copy", async () => {
    expect(groupProfileApi.handlePatchGroupVouch).toBeTypeOf("function");

    const reserveIdempotencyKey = vi.fn(async () => undefined);
    const persistGroupVouchUpdate = vi.fn(async (input: Record<string, unknown>) => input.vouch as GroupVouch);

    const result = await groupProfileApi.handlePatchGroupVouch?.(
      { member: { memberId: "member_2" }, idempotencyKey: "idem-vouch-approval" },
      { groupId: "group_1", vouchId: "vouch_1" },
      { subjectApproved: true },
      {
        reserveIdempotencyKey,
        loadGroupVouchUpdateContext: vi.fn(async () => ({
          vouch: existingVouch,
          activeMemberIds
        })),
        moderateGroupVouch: vi.fn(),
        now: () => new Date("2026-06-20T10:10:00.000Z"),
        persistGroupVouchUpdate
      }
    );

    expect(reserveIdempotencyKey).toHaveBeenCalledWith(
      "PATCH /v1/groups/{groupId}/vouches/{vouchId}",
      "idem-vouch-approval",
      "member_2"
    );
    expect(result).toEqual({
      id: "vouch_1",
      moderationStatus: "approved",
      subjectApprovedAt: "2026-06-20T10:10:00.000Z",
      hiddenAt: null
    });
  });

  it("requires idempotency before creating or updating vouches", async () => {
    await expect(
      groupProfileApi.handlePostGroupVouch?.(
        { member, idempotencyKey: null },
        { groupId: "group_1" },
        { subjectMemberId: "member_2", body: "Ari keeps plans calm." },
        {
          reserveIdempotencyKey: vi.fn(),
          loadGroupVouchAccess: vi.fn(),
          moderateGroupVouch: vi.fn(),
          nextVouchId: () => "vouch_1",
          now: () => new Date("2026-06-20T10:00:00.000Z"),
          persistGroupVouch: vi.fn()
        }
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
