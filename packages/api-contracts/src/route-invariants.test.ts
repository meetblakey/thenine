import { describe, expect, it } from "vitest";
import {
  CLIENT_RESOURCE_CONTRACTS,
  ContractInvariantError,
  INTRODUCTION_ROUTE_CONTRACTS,
  P0_ROUTE_CONTRACTS,
  assertNoMemberDiscoveryRoutes,
  assertMutatingRoutesRequireIdempotency,
  assertNoRankingScoresInClientResources,
  assertNoSoloDatingVocabulary,
  assertP0DatingRoutesAreGroupOwned,
  assertProviderWebhooksUseReplayProtection
} from "./route-invariants.js";

describe("Introduction API route invariants", () => {
  it("keeps dating inventory routes keyed by recipientGroupId through group paths", () => {
    expect(() => {
      assertNoMemberDiscoveryRoutes(INTRODUCTION_ROUTE_CONTRACTS);
    }).not.toThrow();

    expect(INTRODUCTION_ROUTE_CONTRACTS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "GET",
          path: "/v1/groups/{groupId}/introductions/daily",
          recipientScope: "recipientGroupId"
        })
      ])
    );
  });

  it("rejects a route that accepts memberId as a dating inventory recipient", () => {
    expect(() => {
      assertNoMemberDiscoveryRoutes([
        {
          method: "GET",
          path: "/v1/members/{memberId}/introductions",
          recipientScope: "memberId",
          requestFields: [],
          queryFields: ["memberId"]
        }
      ]);
    }).toThrow(
      new ContractInvariantError(
        "MEMBER_DISCOVERY_ROUTE_FORBIDDEN",
        "Dating inventory routes must be group-scoped and must not accept memberId."
      )
    );
  });
});

describe("P0 API contract invariants", () => {
  it("covers the first group-owned vertical slice routes", () => {
    expect(P0_ROUTE_CONTRACTS.map((route) => route.path)).toEqual(
      expect.arrayContaining([
        "/v1/verification/sessions",
        "/v1/verification/appeals",
        "/v1/webhooks/persona",
        "/v1/groups",
        "/v1/groups/{groupId}/invites",
        "/v1/group-invites/{token}/accept",
        "/v1/groups/{groupId}/vouches",
        "/v1/groups/{groupId}/vouches/{vouchId}",
        "/v1/groups/{groupId}/publish-approvals",
        "/v1/groups/{groupId}/pause",
        "/v1/groups/{groupId}/introductions/daily",
        "/v1/groups/{groupId}/introductions/{introductionId}/interest",
        "/v1/groups/{groupId}/conversations",
        "/v1/conversations/{conversationId}/messages",
        "/v1/conversations/{conversationId}/plans",
        "/v1/plans/{planId}/rsvps",
        "/v1/plans/{planId}/debriefs",
        "/v1/safety/reports",
        "/v1/safety/urgent-actions"
      ])
    );
  });

  it("requires idempotency for every non-webhook mutating route", () => {
    expect(() => assertMutatingRoutesRequireIdempotency(P0_ROUTE_CONTRACTS)).not.toThrow();

    expect(() =>
      assertMutatingRoutesRequireIdempotency([
        {
          method: "POST",
          path: "/v1/groups/{groupId}/introductions/{introductionId}/interest",
          recipientScope: "recipientGroupId",
          requestFields: ["clientNonce"],
          queryFields: [],
          ownerScope: "group",
          requiresIdempotencyKey: false,
          isProviderWebhook: false
        }
      ])
    ).toThrow(
      new ContractInvariantError(
        "MUTATION_IDEMPOTENCY_REQUIRED",
        "Mutating API routes must require Idempotency-Key unless they are provider webhooks."
      )
    );
  });

  it("requires replay protection for provider webhooks", () => {
    expect(() => assertProviderWebhooksUseReplayProtection(P0_ROUTE_CONTRACTS)).not.toThrow();

    expect(() =>
      assertProviderWebhooksUseReplayProtection([
        {
          method: "POST",
          path: "/v1/webhooks/persona",
          recipientScope: "none",
          requestFields: [],
          queryFields: [],
          ownerScope: "provider",
          requiresIdempotencyKey: false,
          isProviderWebhook: true
        }
      ])
    ).toThrow(
      new ContractInvariantError(
        "PROVIDER_REPLAY_PROTECTION_REQUIRED",
        "Provider webhook routes must declare provider event replay protection."
      )
    );
  });

  it("keeps P0 dating surfaces group-owned instead of member-owned", () => {
    expect(() => assertP0DatingRoutesAreGroupOwned(P0_ROUTE_CONTRACTS)).not.toThrow();

    expect(() =>
      assertP0DatingRoutesAreGroupOwned([
        {
          method: "GET",
          path: "/v1/members/{memberId}/conversations",
          recipientScope: "memberId",
          requestFields: [],
          queryFields: [],
          ownerScope: "member",
          requiresIdempotencyKey: false,
          isProviderWebhook: false,
          datingSurface: true
        }
      ])
    ).toThrow(
      new ContractInvariantError(
        "P0_DATING_ROUTE_MUST_BE_GROUP_OWNED",
        "P0 dating routes must be group, conversation, plan, or debrief scoped."
      )
    );
  });

  it("forbids solo-dating vocabulary and ranking-only scores from client contracts", () => {
    expect(() => assertNoSoloDatingVocabulary(P0_ROUTE_CONTRACTS)).not.toThrow();
    expect(() => assertNoRankingScoresInClientResources(CLIENT_RESOURCE_CONTRACTS)).not.toThrow();

    expect(() =>
      assertNoRankingScoresInClientResources([
        { name: "IntroductionResource", fields: ["id", "recipientGroupId", "compatibilityScore"] }
      ])
    ).toThrow(
      new ContractInvariantError(
        "RANKING_SCORE_RESPONSE_FORBIDDEN",
        "Client resource contracts must not expose compatibility or reliability scores."
      )
    );
  });
});
