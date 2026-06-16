import { sanitizeAnalyticsPayload } from "./invariants.js";

export type AnalyticsFamily =
  | "onboarding"
  | "group_formation"
  | "discovery"
  | "match_and_chat"
  | "planning"
  | "attendance"
  | "debrief"
  | "safety"
  | "monetization"
  | "notifications"
  | "privacy_and_consent"
  | "provider_health"
  | "liquidity";

export interface AnalyticsEventInput {
  eventName: string;
  properties: Record<string, unknown>;
}

export interface AnalyticsEvent {
  eventName: string;
  family: AnalyticsFamily;
  properties: Record<string, unknown>;
}

interface AnalyticsEventDefinition {
  family: AnalyticsFamily;
  requiredProperties: string[];
}

const analyticsEventDefinitions = {
  account_created: {
    family: "onboarding",
    requiredProperties: ["city", "member_id", "source"]
  },
  verification_started: {
    family: "onboarding",
    requiredProperties: ["city", "member_id", "status"]
  },
  verification_approved: {
    family: "onboarding",
    requiredProperties: ["city", "member_id", "status"]
  },
  standards_accepted: {
    family: "onboarding",
    requiredProperties: ["city", "member_id", "status"]
  },
  group_created: {
    family: "group_formation",
    requiredProperties: ["city", "group_id", "status"]
  },
  invite_sent: {
    family: "group_formation",
    requiredProperties: ["city", "group_id", "source"]
  },
  invite_accepted: {
    family: "group_formation",
    requiredProperties: ["city", "group_id", "status"]
  },
  group_published: {
    family: "group_formation",
    requiredProperties: ["city", "group_id", "status"]
  },
  group_paused: {
    family: "group_formation",
    requiredProperties: ["city", "group_id", "status"]
  },
  introductions_loaded: {
    family: "discovery",
    requiredProperties: ["city", "group_id", "status"]
  },
  introduction_shown: {
    family: "discovery",
    requiredProperties: ["city", "group_id", "introduction_id"]
  },
  first_introduction_shown: {
    family: "discovery",
    requiredProperties: ["city", "group_id", "introduction_id"]
  },
  group_card_viewed: {
    family: "discovery",
    requiredProperties: ["city", "group_id", "introduction_id"]
  },
  group_interest_started: {
    family: "discovery",
    requiredProperties: ["city", "group_id", "introduction_id", "status"]
  },
  group_interest_approved: {
    family: "discovery",
    requiredProperties: ["city", "group_id", "introduction_id", "status"]
  },
  group_passed: {
    family: "discovery",
    requiredProperties: ["city", "group_id", "introduction_id", "reason_category"]
  },
  group_match_created: {
    family: "match_and_chat",
    requiredProperties: ["city", "group_id", "conversation_id"]
  },
  group_chat_opened: {
    family: "match_and_chat",
    requiredProperties: ["city", "group_id", "conversation_id"]
  },
  message_sent: {
    family: "match_and_chat",
    requiredProperties: ["city", "group_id", "conversation_id", "status"]
  },
  prompt_used: {
    family: "match_and_chat",
    requiredProperties: ["city", "group_id", "conversation_id"]
  },
  chat_expired: {
    family: "match_and_chat",
    requiredProperties: ["city", "group_id", "conversation_id", "status"]
  },
  planner_opened: {
    family: "planning",
    requiredProperties: ["city", "group_id", "conversation_id"]
  },
  plan_proposed: {
    family: "planning",
    requiredProperties: ["city", "group_id", "conversation_id", "plan_id", "status"]
  },
  plan_poll_created: {
    family: "planning",
    requiredProperties: ["city", "group_id", "conversation_id", "plan_id", "status"]
  },
  plan_voted: {
    family: "planning",
    requiredProperties: ["city", "group_id", "plan_id", "status"]
  },
  rsvp_confirmed: {
    family: "planning",
    requiredProperties: ["city", "group_id", "plan_id", "status"]
  },
  plan_confirmed: {
    family: "planning",
    requiredProperties: ["city", "group_id", "plan_id", "status"]
  },
  plan_canceled: {
    family: "planning",
    requiredProperties: ["city", "group_id", "plan_id", "status", "reason_category"]
  },
  meetup_checkin_sent: {
    family: "attendance",
    requiredProperties: ["city", "group_id", "plan_id", "status"]
  },
  attendance_confirmed: {
    family: "attendance",
    requiredProperties: ["city", "group_id", "plan_id", "status"]
  },
  meetup_verified: {
    family: "attendance",
    requiredProperties: ["city", "group_id", "plan_id", "status"]
  },
  no_show_recorded: {
    family: "attendance",
    requiredProperties: ["city", "group_id", "plan_id", "reason_category"]
  },
  debrief_started: {
    family: "debrief",
    requiredProperties: ["city", "group_id", "plan_id", "status"]
  },
  debrief_completed: {
    family: "debrief",
    requiredProperties: ["city", "group_id", "plan_id", "status"]
  },
  interest_signal_submitted: {
    family: "debrief",
    requiredProperties: ["city", "group_id", "plan_id", "status"]
  },
  mutual_edge_created: {
    family: "debrief",
    requiredProperties: ["city", "group_id", "plan_id", "status"]
  },
  quality_rating_submitted: {
    family: "debrief",
    requiredProperties: ["city", "group_id", "plan_id", "status"]
  },
  report_started: {
    family: "safety",
    requiredProperties: ["city", "surface", "status"]
  },
  report_submitted: {
    family: "safety",
    requiredProperties: ["city", "surface", "status"]
  },
  block_confirmed: {
    family: "safety",
    requiredProperties: ["city", "group_id", "surface", "status"]
  },
  leave_group_confirmed: {
    family: "safety",
    requiredProperties: ["city", "group_id", "surface", "status"]
  },
  safety_case_resolved: {
    family: "safety",
    requiredProperties: ["city", "surface", "status"]
  },
  paywall_viewed: {
    family: "monetization",
    requiredProperties: ["city", "group_id", "source"]
  },
  purchase_started: {
    family: "monetization",
    requiredProperties: ["city", "group_id", "status"]
  },
  purchase_completed: {
    family: "monetization",
    requiredProperties: ["city", "group_id", "status"]
  },
  subscription_canceled: {
    family: "monetization",
    requiredProperties: ["city", "group_id", "status", "reason_category"]
  },
  refund_processed: {
    family: "monetization",
    requiredProperties: ["city", "group_id", "status", "reason_category"]
  },
  notification_intent_created: {
    family: "notifications",
    requiredProperties: ["city", "group_id", "status"]
  },
  notification_sent: {
    family: "notifications",
    requiredProperties: ["city", "group_id", "status"]
  },
  notification_held: {
    family: "notifications",
    requiredProperties: ["city", "group_id", "status", "reason_category"]
  },
  notification_suppressed: {
    family: "notifications",
    requiredProperties: ["city", "group_id", "status", "reason_category"]
  },
  notification_opened: {
    family: "notifications",
    requiredProperties: ["city", "group_id", "status"]
  },
  notification_action_completed: {
    family: "notifications",
    requiredProperties: ["city", "group_id", "status"]
  },
  notification_disabled: {
    family: "notifications",
    requiredProperties: ["city", "member_id", "status"]
  },
  debrief_learning_consent_granted: {
    family: "privacy_and_consent",
    requiredProperties: ["city", "group_id", "status"]
  },
  debrief_learning_consent_declined: {
    family: "privacy_and_consent",
    requiredProperties: ["city", "group_id", "status"]
  },
  debrief_learning_consent_revoked: {
    family: "privacy_and_consent",
    requiredProperties: ["city", "group_id", "status"]
  },
  calendar_import_connected: {
    family: "privacy_and_consent",
    requiredProperties: ["city", "group_id", "status"]
  },
  calendar_import_revoked: {
    family: "privacy_and_consent",
    requiredProperties: ["city", "group_id", "status"]
  },
  moment_approved: {
    family: "privacy_and_consent",
    requiredProperties: ["city", "group_id", "status"]
  },
  verification_provider_approved: {
    family: "provider_health",
    requiredProperties: ["city", "member_id", "status"]
  },
  verification_provider_retried: {
    family: "provider_health",
    requiredProperties: ["city", "member_id", "status", "reason_category"]
  },
  moderation_held: {
    family: "provider_health",
    requiredProperties: ["city", "group_id", "status", "reason_category"]
  },
  push_delivery_failed: {
    family: "provider_health",
    requiredProperties: ["city", "group_id", "status", "reason_category"]
  },
  payment_webhook_received: {
    family: "provider_health",
    requiredProperties: ["city", "group_id", "status"]
  },
  realtime_error_recorded: {
    family: "provider_health",
    requiredProperties: ["city", "group_id", "status", "reason_category"]
  },
  eligible_groups_measured: {
    family: "liquidity",
    requiredProperties: ["city", "status"]
  },
  introduction_availability_measured: {
    family: "liquidity",
    requiredProperties: ["city", "group_id", "status"]
  },
  supply_gap_recorded: {
    family: "liquidity",
    requiredProperties: ["city", "status", "reason_category"]
  },
  venue_slot_measured: {
    family: "liquidity",
    requiredProperties: ["city", "status"]
  }
} satisfies Record<string, AnalyticsEventDefinition>;

export type AnalyticsEventName = keyof typeof analyticsEventDefinitions;

export function buildAnalyticsEvent(input: AnalyticsEventInput): AnalyticsEvent {
  const definition = analyticsEventDefinitions[input.eventName as AnalyticsEventName];

  if (definition === undefined) {
    throw new Error(`Unknown analytics event: ${input.eventName}`);
  }

  const properties = sanitizeAnalyticsPayload(input.properties);

  for (const propertyName of definition.requiredProperties) {
    const value = properties[propertyName];

    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Analytics event ${input.eventName} requires ${propertyName}.`);
    }
  }

  return {
    eventName: input.eventName,
    family: definition.family,
    properties
  };
}
