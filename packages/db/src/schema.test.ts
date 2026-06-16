import { describe, expect, it } from "vitest";
import {
  initialMigrationSql,
  p0SchemaTables,
  schemaTableNames,
  validateSchemaPrivacyBoundaries
} from "./index.js";

const expectedP0Tables = [
  "cities",
  "members",
  "verification_cases",
  "groups",
  "group_memberships",
  "group_invites",
  "invite_relay_events",
  "group_readiness_snapshots",
  "group_availability_snapshots",
  "group_profiles",
  "vouch_blurbs",
  "media_assets",
  "introduction_sets",
  "introductions",
  "introduction_decisions",
  "conversations",
  "conversation_groups",
  "conversation_participants",
  "messages",
  "breakout_requests",
  "venues",
  "plan_fast_track_proposals",
  "plans",
  "plan_groups",
  "plan_options",
  "plan_votes",
  "plan_rsvps",
  "trusted_contact_shares",
  "attendance_confirmations",
  "debriefs",
  "debrief_interests",
  "debrief_learning_consents",
  "recommendation_feature_snapshots",
  "mutual_edges",
  "safety_reports",
  "safety_actions",
  "consensus_block_votes",
  "blocks",
  "moderation_cases",
  "action_queue_items",
  "notification_preferences",
  "notification_intents",
  "domain_event_outbox",
  "audit_logs",
  "idempotency_keys",
  "provider_webhook_events"
];

describe("P0 database schema contract", () => {
  it("defines every core table needed for the first group-owned vertical slice", () => {
    expect(schemaTableNames).toEqual(expect.arrayContaining(expectedP0Tables));
  });

  it("keeps dating inventory group-owned in schema metadata", () => {
    expect(p0SchemaTables.introduction_sets.columns).toContain("recipient_group_id");
    expect(p0SchemaTables.introduction_sets.columns).not.toContain("recipient_member_id");
    expect(p0SchemaTables.introductions.columns).toContain("recipient_group_id");
    expect(p0SchemaTables.introductions.columns).not.toContain("recipient_member_id");
    expect(p0SchemaTables.conversation_groups.columns).toEqual(
      expect.arrayContaining(["conversation_id", "group_id"])
    );
    expect(p0SchemaTables.conversation_participants.columns).toEqual(
      expect.arrayContaining(["conversation_id", "member_id", "group_id"])
    );
  });

  it("defines Launchpad readiness snapshots without dating inventory fields", () => {
    expect(p0SchemaTables.group_readiness_snapshots.columns).toEqual(
      expect.arrayContaining(["id", "group_id", "member_id", "blockers", "next_action", "computed_at", "source_event_id"])
    );
    expect(p0SchemaTables.group_readiness_snapshots.columns).not.toEqual(
      expect.arrayContaining(["introduction_id", "recipient_member_id", "member_inventory", "compatibility_score", "reliability_score"])
    );
  });

  it("defines group-level availability snapshots without raw calendar content", () => {
    expect(p0SchemaTables.group_availability_snapshots.columns).toEqual(
      expect.arrayContaining([
        "id",
        "group_id",
        "window_start",
        "window_end",
        "timezone",
        "source",
        "confirmed_by_member_ids",
        "computed_at",
        "source_event_id"
      ])
    );
    expect(p0SchemaTables.group_availability_snapshots.columns).not.toEqual(
      expect.arrayContaining(["event_title", "attendees", "notes", "links", "location", "raw_calendar_content"])
    );
  });

  it("keeps raw provider, calendar, report, compatibility, and reliability data out of persistence metadata", () => {
    expect(() => validateSchemaPrivacyBoundaries(p0SchemaTables)).not.toThrow();
  });

  it("models debrief learning consent separately from private one-sided interest", () => {
    expect(p0SchemaTables.debrief_learning_consents.columns).toEqual(
      expect.arrayContaining([
        "id",
        "debrief_id",
        "plan_id",
        "member_id",
        "group_id",
        "status",
        "granted_at",
        "declined_at",
        "revoked_at"
      ])
    );
    expect(p0SchemaTables.recommendation_feature_snapshots.columns).toEqual(
      expect.arrayContaining(["id", "consent_id", "debrief_id", "plan_id", "member_id", "group_id", "feature_payload", "active", "expires_at"])
    );
    expect(p0SchemaTables.recommendation_feature_snapshots.columns).not.toEqual(
      expect.arrayContaining(["target_member_id", "signal", "raw_debrief_interest", "compatibility_score", "reliability_score"])
    );
  });

  it("defines persisted action queue items sourced by domain events", () => {
    expect(p0SchemaTables.action_queue_items.columns).toEqual(
      expect.arrayContaining([
        "id",
        "member_id",
        "group_id",
        "source_event_id",
        "target_type",
        "target_id",
        "action_kind",
        "deadline_at",
        "status",
        "dismissible"
      ])
    );
    expect(p0SchemaTables.action_queue_items.columns).not.toEqual(
      expect.arrayContaining(["session_id", "reengagement_score", "generic_prompt"])
    );
  });

  it("defines Plan Fast Track proposals before Plan confirmation", () => {
    expect(p0SchemaTables.plan_fast_track_proposals.columns).toEqual(
      expect.arrayContaining([
        "id",
        "conversation_id",
        "created_by_member_id",
        "source_group_id",
        "proposal_state",
        "time_options",
        "venue_options",
        "accepted_plan_id"
      ])
    );
    expect(p0SchemaTables.plan_fast_track_proposals.columns).not.toEqual(
      expect.arrayContaining(["confirmed_at", "recipient_member_id", "booking_id"])
    );
  });

  it("defines Invite Relay events without broad contact storage", () => {
    expect(p0SchemaTables.invite_relay_events.columns).toEqual(
      expect.arrayContaining(["id", "invite_id", "group_id", "event_type", "source_channel", "occurred_at"])
    );
    expect(p0SchemaTables.invite_relay_events.columns).not.toEqual(
      expect.arrayContaining(["phone", "email", "contact_list", "raw_contact"])
    );
  });

  it("defines vouch blurbs as group-contextual moderated copy with subject consent", () => {
    expect(p0SchemaTables.vouch_blurbs.columns).toEqual(
      expect.arrayContaining([
        "id",
        "group_id",
        "author_member_id",
        "subject_member_id",
        "body",
        "subject_approved_at",
        "moderation_status",
        "hidden_at"
      ])
    );
    expect(p0SchemaTables.vouch_blurbs.columns).not.toEqual(
      expect.arrayContaining(["recipient_member_id", "invitee_member_id", "raw_contact", "compatibility_score", "reliability_score"])
    );
  });
});

describe("initial migration guardrails", () => {
  it("enables required Postgres extensions for the documented stack", () => {
    expect(initialMigrationSql).toContain('CREATE EXTENSION IF NOT EXISTS "citext"');
    expect(initialMigrationSql).toContain('CREATE EXTENSION IF NOT EXISTS "postgis"');
  });

  it("enforces group-owned introductions and paid distribution floor separation", () => {
    const introductionTableSql = initialMigrationSql.slice(
      initialMigrationSql.indexOf("CREATE TABLE introductions"),
      initialMigrationSql.indexOf("CREATE TABLE introduction_decisions")
    );

    expect(initialMigrationSql).toContain("recipient_group_id uuid NOT NULL");
    expect(introductionTableSql).not.toContain("recipient_member_id");
    expect(initialMigrationSql).toContain("CHECK (baseline_size >= 0)");
    expect(initialMigrationSql).toContain("CHECK (entitlement_extra_size >= 0)");
    expect(initialMigrationSql).toContain(
      "CHECK ((target_group_id IS NOT NULL AND target_plan_id IS NULL) OR (target_group_id IS NULL AND target_plan_id IS NOT NULL))"
    );
  });

  it("enforces group-owned conversations, accepted Breakout context, and private debrief defaults", () => {
    expect(initialMigrationSql).toContain("PRIMARY KEY (conversation_id, group_id)");
    expect(initialMigrationSql).toContain("parent_conversation_id uuid NOT NULL REFERENCES conversations(id)");
    expect(initialMigrationSql).toContain("visibility_status text NOT NULL DEFAULT 'private'");
    expect(initialMigrationSql).toContain("CREATE TABLE debrief_learning_consents");
    expect(initialMigrationSql).toContain("CREATE TABLE recommendation_feature_snapshots");
    expect(initialMigrationSql).toContain("feature_payload jsonb NOT NULL");
    expect(initialMigrationSql).toContain("active boolean NOT NULL");
  });

  it("enforces event-sourced notifications, idempotency, provider replay protection, and staff audit", () => {
    expect(initialMigrationSql).toContain("source_event_id uuid NOT NULL REFERENCES domain_event_outbox(id)");
    expect(initialMigrationSql).toContain("CREATE TABLE action_queue_items");
    expect(initialMigrationSql).toContain("source_event_id uuid NOT NULL REFERENCES domain_event_outbox(id)");
    expect(initialMigrationSql).toContain("dedupe_key text NOT NULL UNIQUE");
    expect(initialMigrationSql).toContain("CREATE TABLE group_readiness_snapshots");
    expect(initialMigrationSql).toContain("CREATE TABLE invite_relay_events");
    expect(initialMigrationSql).toContain("CREATE TABLE vouch_blurbs");
    expect(initialMigrationSql).toContain("subject_approved_at timestamptz");
    expect(initialMigrationSql).toContain("CREATE INDEX idx_vouch_blurbs_group_visible");
    expect(initialMigrationSql).toContain("CREATE UNIQUE INDEX group_readiness_snapshots_group_member_key");
    expect(initialMigrationSql).toContain("CREATE TABLE group_availability_snapshots");
    expect(initialMigrationSql).toContain("CREATE INDEX idx_group_availability_snapshots_group_window");
    expect(initialMigrationSql).toContain("CREATE TABLE plan_fast_track_proposals");
    expect(initialMigrationSql).toContain("time_options jsonb NOT NULL");
    expect(initialMigrationSql).toContain("CREATE UNIQUE INDEX provider_webhook_events_provider_event_key");
    expect(initialMigrationSql).toContain("CREATE UNIQUE INDEX idempotency_keys_route_key");
    expect(initialMigrationSql).toContain("CREATE TABLE audit_logs");
  });

  it("does not create forbidden raw verification or calendar-content columns", () => {
    expect(initialMigrationSql).not.toMatch(/government_id|liveness|raw_document|raw_provider_document/i);
    expect(initialMigrationSql).not.toMatch(/calendar_title|calendar_attendees|calendar_notes|calendar_location/i);
  });
});
