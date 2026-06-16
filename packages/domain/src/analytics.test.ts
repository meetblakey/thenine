import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type AnalyticsDomainExports = typeof domain & {
  buildAnalyticsEvent?: (input: { eventName: string; properties: Record<string, unknown> }) => {
    eventName: string;
    family: string;
    properties: Record<string, unknown>;
  };
};

const analyticsDomain = domain as AnalyticsDomainExports;

describe("analytics event builder", () => {
  it("builds P0 meetup funnel events with required group and plan identifiers", () => {
    expect(analyticsDomain.buildAnalyticsEvent).toBeTypeOf("function");

    expect(
      analyticsDomain.buildAnalyticsEvent?.({
        eventName: "plan_confirmed",
        properties: {
          city: "sydney",
          group_id: "group_1",
          plan_id: "plan_1",
          status: "confirmed",
          rawReportNarrative: "private",
          compatibilityScore: 0.91
        }
      })
    ).toEqual({
      eventName: "plan_confirmed",
      family: "planning",
      properties: {
        city: "sydney",
        group_id: "group_1",
        plan_id: "plan_1",
        status: "confirmed"
      }
    });
  });

  it("rejects missing required object identifiers", () => {
    expect(analyticsDomain.buildAnalyticsEvent).toBeTypeOf("function");

    expect(() =>
      analyticsDomain.buildAnalyticsEvent?.({
        eventName: "debrief_completed",
        properties: {
          city: "sydney",
          group_id: "group_1"
        }
      })
    ).toThrow(/plan_id/i);
  });

  it("rejects events outside the locked P0 dictionary", () => {
    expect(analyticsDomain.buildAnalyticsEvent).toBeTypeOf("function");

    expect(() =>
      analyticsDomain.buildAnalyticsEvent?.({
        eventName: "session_reactivated",
        properties: {
          city: "sydney"
        }
      })
    ).toThrow(/unknown analytics event/i);
  });
});
