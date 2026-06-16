import { describe, expect, it } from "vitest";

import {
  ENGINEERING_INVARIANT_TESTS,
  REQUIRED_INVARIANT_TEST_GROUPS,
  assertInvariantInventoryComplete
} from "./invariant-inventory.js";

describe("engineering invariant test inventory", () => {
  it("covers every required invariant group with owners and expected failure modes", () => {
    expect(() => assertInvariantInventoryComplete(ENGINEERING_INVARIANT_TESTS)).not.toThrow();

    expect(new Set(ENGINEERING_INVARIANT_TESTS.map((entry) => entry.group))).toEqual(
      new Set(REQUIRED_INVARIANT_TEST_GROUPS)
    );

    for (const entry of ENGINEERING_INVARIANT_TESTS) {
      expect(entry.fixtureOwner).not.toHaveLength(0);
      expect(entry.expectedFailureMode).not.toHaveLength(0);
      expect(entry.evidence.command).not.toHaveLength(0);
    }
  });

  it("keeps expansion-only Moment privacy explicitly deferred instead of untracked", () => {
    const momentPrivacy = ENGINEERING_INVARIANT_TESTS.find((entry) => entry.group === "Moment privacy");

    expect(momentPrivacy).toMatchObject({
      implementationStatus: "deferred",
      mustPassBefore: "production"
    });
    expect(momentPrivacy?.deferredReason).toMatch(/Moment/i);
  });
});
