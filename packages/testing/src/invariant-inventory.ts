export const REQUIRED_INVARIANT_TEST_GROUPS = [
  "Group-first distribution",
  "Group eligibility",
  "Quartet rules",
  "Conversation ownership",
  "Debrief privacy",
  "Recommendation consent",
  "Paid guardrails",
  "Notification source",
  "Safety access",
  "Provider idempotency",
  "Staff audit",
  "Calendar privacy",
  "Moment privacy"
] as const;

export type RequiredInvariantTestGroup = (typeof REQUIRED_INVARIANT_TEST_GROUPS)[number];
export type InvariantDomain =
  | "group"
  | "matching"
  | "conversation"
  | "plan"
  | "debrief"
  | "safety"
  | "notification"
  | "entitlement"
  | "provider"
  | "staff"
  | "privacy";
export type InvariantTestStatus = "implemented" | "deferred";

export interface EngineeringInvariantTest {
  id: string;
  group: RequiredInvariantTestGroup;
  domain: InvariantDomain;
  assertion: string;
  fixture: string;
  fixtureOwner: string;
  expectedFailureMode: string;
  mustPassBefore: "merge" | "staging" | "production";
  implementationStatus: InvariantTestStatus;
  evidence: {
    testPath: string;
    command: string;
  };
  deferredReason?: string;
}

export const ENGINEERING_INVARIANT_TESTS: EngineeringInvariantTest[] = [
  {
    id: "group-first-no-member-discovery",
    group: "Group-first distribution",
    domain: "group",
    assertion: "Dating inventory routes reject memberId recipients and use recipientGroupId through group paths.",
    fixture: "packages/api-contracts/src/route-invariants.test.ts",
    fixtureOwner: "api-contracts",
    expectedFailureMode: "MEMBER_DISCOVERY_ROUTE_FORBIDDEN",
    mustPassBefore: "merge",
    implementationStatus: "implemented",
    evidence: {
      testPath: "packages/api-contracts/src/route-invariants.test.ts",
      command: "pnpm test:contract"
    }
  },
  {
    id: "group-eligibility-hard-gate",
    group: "Group eligibility",
    domain: "group",
    assertion: "Incomplete, unverified, moderation-held, safety-paused, or publish-unapproved Groups cannot receive Introductions.",
    fixture: "packages/domain/src/group-eligibility.test.ts",
    fixtureOwner: "domain",
    expectedFailureMode: "GROUP_INELIGIBLE",
    mustPassBefore: "merge",
    implementationStatus: "implemented",
    evidence: {
      testPath: "packages/domain/src/group-eligibility.test.ts",
      command: "pnpm --filter @thenine/domain test -- src/group-eligibility.test.ts"
    }
  },
  {
    id: "quartet-exactly-two-active-verified",
    group: "Quartet rules",
    domain: "group",
    assertion: "Quartet Groups require exactly two active verified members.",
    fixture: "packages/domain/src/domain-invariants.test.ts",
    fixtureOwner: "domain",
    expectedFailureMode: "quartet_requires_exactly_two_active_verified_members",
    mustPassBefore: "merge",
    implementationStatus: "implemented",
    evidence: {
      testPath: "packages/domain/src/domain-invariants.test.ts",
      command: "pnpm --filter @thenine/domain test -- src/domain-invariants.test.ts"
    }
  },
  {
    id: "conversation-group-owned-breakout-consent",
    group: "Conversation ownership",
    domain: "conversation",
    assertion: "Group chats are Group-owned and Breakouts require accepted consent with parent context.",
    fixture: "packages/domain/src/conversation-thread.test.ts",
    fixtureOwner: "domain",
    expectedFailureMode: "CONVERSATION_CLOSED or Breakout consent error",
    mustPassBefore: "merge",
    implementationStatus: "implemented",
    evidence: {
      testPath: "packages/domain/src/conversation-thread.test.ts",
      command: "pnpm --filter @thenine/domain test -- src/conversation-thread.test.ts"
    }
  },
  {
    id: "debrief-one-sided-interest-private",
    group: "Debrief privacy",
    domain: "debrief",
    assertion: "One-sided post-meetup interest is not visible to targets, Groups, staff outside audited safety need, analytics, or public shares.",
    fixture: "packages/domain/src/domain-invariants.test.ts",
    fixtureOwner: "domain",
    expectedFailureMode: "No mutual edge is returned for one-sided interest.",
    mustPassBefore: "merge",
    implementationStatus: "implemented",
    evidence: {
      testPath: "packages/domain/src/domain-invariants.test.ts",
      command: "pnpm --filter @thenine/domain test -- src/domain-invariants.test.ts"
    }
  },
  {
    id: "recommendation-consent-required",
    group: "Recommendation consent",
    domain: "debrief",
    assertion: "Debrief preference data is not available for ranking unless explicit consent is active.",
    fixture: "packages/domain/src/debrief-learning-consent.test.ts",
    fixtureOwner: "domain",
    expectedFailureMode: "CONSENT_REQUIRED or false ranking eligibility.",
    mustPassBefore: "merge",
    implementationStatus: "implemented",
    evidence: {
      testPath: "packages/domain/src/debrief-learning-consent.test.ts",
      command: "pnpm --filter @thenine/domain test -- src/debrief-learning-consent.test.ts"
    }
  },
  {
    id: "paid-additive-free-baseline-preserved",
    group: "Paid guardrails",
    domain: "entitlement",
    assertion: "Paid state can add explicit stack size but cannot reduce free baseline distribution or affect ranking weights.",
    fixture: "packages/domain/src/domain-invariants.test.ts",
    fixtureOwner: "domain",
    expectedFailureMode: "baselineCount drops below freeBaselineSize.",
    mustPassBefore: "merge",
    implementationStatus: "implemented",
    evidence: {
      testPath: "packages/domain/src/domain-invariants.test.ts",
      command: "pnpm --filter @thenine/domain test -- src/domain-invariants.test.ts"
    }
  },
  {
    id: "notification-source-event-required",
    group: "Notification source",
    domain: "notification",
    assertion: "Notification intents require a persisted source event and dedupe key.",
    fixture: "apps/workers/src/outbox-worker.test.ts",
    fixtureOwner: "workers",
    expectedFailureMode: "Notification decision sourceEventId mismatch or missing source event.",
    mustPassBefore: "merge",
    implementationStatus: "implemented",
    evidence: {
      testPath: "apps/workers/src/outbox-worker.test.ts",
      command: "pnpm test:integration"
    }
  },
  {
    id: "safety-one-tap-active-surfaces",
    group: "Safety access",
    domain: "safety",
    assertion: "Report, block, leave, urgent help, and share-plan actions exist within one tap on active risky surfaces.",
    fixture: "packages/domain/src/domain-invariants.test.ts",
    fixtureOwner: "domain",
    expectedFailureMode: "Missing one-tap safety action name.",
    mustPassBefore: "merge",
    implementationStatus: "implemented",
    evidence: {
      testPath: "packages/domain/src/domain-invariants.test.ts",
      command: "pnpm --filter @thenine/domain test -- src/domain-invariants.test.ts"
    }
  },
  {
    id: "provider-webhook-signature-replay-protection",
    group: "Provider idempotency",
    domain: "provider",
    assertion: "Persona, Hive, OneSignal, RevenueCat, and Stripe integrations validate signatures and provider event replay keys where applicable.",
    fixture: "packages/api-contracts/src/route-invariants.test.ts",
    fixtureOwner: "api-contracts",
    expectedFailureMode: "PROVIDER_REPLAY_PROTECTION_REQUIRED or provider webhook idempotency error.",
    mustPassBefore: "merge",
    implementationStatus: "implemented",
    evidence: {
      testPath: "packages/api-contracts/src/route-invariants.test.ts",
      command: "pnpm test:contract"
    }
  },
  {
    id: "staff-restricted-access-audited",
    group: "Staff audit",
    domain: "staff",
    assertion: "Staff access to restricted safety data creates a sanitized audit log before data is returned.",
    fixture: "apps/api/src/staff-route.test.ts",
    fixtureOwner: "api",
    expectedFailureMode: "FORBIDDEN or missing audit-before-load call order.",
    mustPassBefore: "merge",
    implementationStatus: "implemented",
    evidence: {
      testPath: "apps/api/src/staff-route.test.ts",
      command: "pnpm --filter @thenine/api test -- src/staff-route.test.ts"
    }
  },
  {
    id: "calendar-raw-content-forbidden",
    group: "Calendar privacy",
    domain: "privacy",
    assertion: "Calendar import never persists raw titles, attendees, notes, links, or locations.",
    fixture: "packages/domain/src/availability-mesh.test.ts",
    fixtureOwner: "domain",
    expectedFailureMode: "Raw calendar event content cannot be persisted.",
    mustPassBefore: "merge",
    implementationStatus: "implemented",
    evidence: {
      testPath: "packages/domain/src/availability-mesh.test.ts",
      command: "pnpm --filter @thenine/domain test -- src/availability-mesh.test.ts"
    }
  },
  {
    id: "moment-public-share-privacy",
    group: "Moment privacy",
    domain: "privacy",
    assertion: "Public Moments require approvals and cannot reveal private interest or non-consenting attendee identity.",
    fixture: "future packages/domain/src/moment-privacy.test.ts",
    fixtureOwner: "growth-privacy",
    expectedFailureMode: "Moment creation rejected without participant approvals or privacy-safe content snapshot.",
    mustPassBefore: "production",
    implementationStatus: "deferred",
    evidence: {
      testPath: "deferred until Shareable Meetup Moment enters scope",
      command: "pnpm test"
    },
    deferredReason: "Shareable Meetup Moment is outside the first P0 vertical slice and remains deferred until the Moment feature slice is introduced."
  }
];

export function assertInvariantInventoryComplete(inventory: EngineeringInvariantTest[]): void {
  const groups = new Set(inventory.map((entry) => entry.group));
  const missingGroups = REQUIRED_INVARIANT_TEST_GROUPS.filter((group) => !groups.has(group));

  if (missingGroups.length > 0) {
    throw new Error(`Invariant test inventory is missing groups: ${missingGroups.join(", ")}`);
  }

  for (const entry of inventory) {
    assertNonEmpty(entry.id, "id");
    assertNonEmpty(entry.assertion, `${entry.id}.assertion`);
    assertNonEmpty(entry.fixture, `${entry.id}.fixture`);
    assertNonEmpty(entry.fixtureOwner, `${entry.id}.fixtureOwner`);
    assertNonEmpty(entry.expectedFailureMode, `${entry.id}.expectedFailureMode`);
    assertNonEmpty(entry.evidence.testPath, `${entry.id}.evidence.testPath`);
    assertNonEmpty(entry.evidence.command, `${entry.id}.evidence.command`);

    if (entry.implementationStatus === "deferred") {
      assertNonEmpty(entry.deferredReason ?? "", `${entry.id}.deferredReason`);
    }
  }
}

function assertNonEmpty(value: string, fieldName: string): void {
  if (value.trim() === "") {
    throw new Error(`Invariant test inventory entry requires ${fieldName}.`);
  }
}
