export const initialMigrationSql = `
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "postgis";

create table cities (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  country_code text not null,
  timezone text not null,
  launch_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table members (
  id uuid primary key,
  auth_subject text not null unique,
  email citext,
  phone_e164 text,
  first_name text not null,
  date_of_birth date,
  age_band text,
  pronouns text,
  city_id uuid not null references cities(id),
  status text not null,
  verification_status text not null,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table verification_cases (
  id uuid primary key,
  member_id uuid not null references members(id),
  provider text not null default 'persona',
  provider_inquiry_id text not null unique,
  status text not null,
  failure_reason_code text,
  appeal_status text,
  risk_flags text[] not null default '{}',
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table groups (
  id uuid primary key,
  city_id uuid not null references cities(id),
  format text not null,
  status text not null,
  name text,
  intent text,
  neighborhood_ids uuid[] not null default '{}',
  availability_windows jsonb not null default '[]',
  publish_approved_at timestamptz,
  eligibility_status text not null,
  eligibility_blockers text[] not null default '{}',
  distribution_floor_version integer not null default 1,
  created_by_member_id uuid not null references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dissolved_at timestamptz
);

create table group_memberships (
  id uuid primary key,
  group_id uuid not null references groups(id),
  member_id uuid not null references members(id),
  role text not null,
  status text not null,
  publish_approved_at timestamptz,
  joined_at timestamptz,
  left_at timestamptz,
  leave_reason_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_memberships_group_member_key unique (group_id, member_id)
);

create table group_invites (
  id uuid primary key,
  group_id uuid not null references groups(id),
  inviter_member_id uuid not null references members(id),
  token_hash text not null unique,
  recipient_hint_hash text,
  status text not null,
  expires_at timestamptz not null,
  accepted_by_member_id uuid references members(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE invite_relay_events (
  id uuid primary key,
  invite_id uuid NOT NULL REFERENCES group_invites(id),
  group_id uuid NOT NULL REFERENCES groups(id),
  event_type text NOT NULL,
  source_channel text NOT NULL,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz not null default now()
);

create table group_profiles (
  id uuid primary key,
  group_id uuid not null unique references groups(id),
  shared_vibe text,
  prompt_answers jsonb not null default '{}',
  member_cards jsonb not null default '[]',
  visibility_preview_hash text,
  moderation_status text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE vouch_blurbs (
  id uuid primary key,
  group_id uuid not null references groups(id),
  author_member_id uuid not null references members(id),
  subject_member_id uuid not null references members(id),
  body text not null,
  subject_approved_at timestamptz,
  moderation_status text not null,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table media_assets (
  id uuid primary key,
  owner_member_id uuid references members(id),
  owner_group_id uuid references groups(id),
  purpose text not null,
  bucket text not null,
  object_key text not null unique,
  content_type text not null,
  byte_size bigint not null,
  checksum_sha256 text not null,
  moderation_status text not null,
  retention_class text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table domain_event_outbox (
  id uuid primary key,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_name text not null,
  event_version integer not null,
  sequence_number bigint not null,
  payload jsonb not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint domain_event_outbox_aggregate_sequence_key unique (aggregate_type, aggregate_id, sequence_number)
);

CREATE TABLE group_readiness_snapshots (
  id uuid primary key,
  group_id uuid NOT NULL REFERENCES groups(id),
  member_id uuid NOT NULL REFERENCES members(id),
  readiness_status text not null,
  blockers text[] not null default '{}',
  next_action text not null,
  secondary_actions text[] not null default '{}',
  source_event_id uuid NOT NULL REFERENCES domain_event_outbox(id),
  computed_at timestamptz NOT NULL,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE group_availability_snapshots (
  id uuid primary key,
  group_id uuid NOT NULL REFERENCES groups(id),
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  timezone text not null,
  source text not null,
  confirmed_by_member_ids uuid[] not null default '{}',
  source_event_id uuid NOT NULL REFERENCES domain_event_outbox(id),
  computed_at timestamptz NOT NULL,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table venues (
  id uuid primary key,
  city_id uuid not null references cities(id),
  name text not null,
  address_line text not null,
  neighborhood_id uuid,
  geo geography(Point,4326),
  venue_type text not null,
  safety_status text not null,
  partner_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table conversations (
  id uuid primary key,
  kind text not null,
  status text not null,
  source_introduction_id uuid,
  parent_conversation_id uuid references conversations(id),
  created_by_member_id uuid references members(id),
  last_message_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table plans (
  id uuid primary key,
  conversation_id uuid references conversations(id),
  city_id uuid not null references cities(id),
  format text not null,
  status text not null,
  venue_id uuid references venues(id),
  manual_venue_name text,
  manual_venue_address text,
  starts_at timestamptz,
  ends_at timestamptz,
  rsvp_deadline_at timestamptz,
  confirmation_rule text not null,
  host_member_id uuid references members(id),
  canceled_reason_code text,
  created_by_member_id uuid not null references members(id),
  confirmed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE plan_fast_track_proposals (
  id uuid primary key,
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  created_by_member_id uuid NOT NULL REFERENCES members(id),
  source_group_id uuid NOT NULL REFERENCES groups(id),
  proposal_state text NOT NULL,
  format text NOT NULL,
  time_options jsonb NOT NULL,
  venue_options jsonb NOT NULL,
  safety_context jsonb NOT NULL,
  accepted_plan_id uuid REFERENCES plans(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz
);

create table introduction_sets (
  id uuid primary key,
  recipient_group_id uuid NOT NULL references groups(id),
  city_id uuid not null references cities(id),
  set_date date not null,
  format text not null,
  baseline_size integer not null,
  entitlement_extra_size integer not null,
  liquidity_mode text not null,
  generated_by_run_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint introduction_sets_group_date_format_key unique (recipient_group_id, set_date, format),
  constraint introduction_sets_baseline_non_negative CHECK (baseline_size >= 0),
  constraint introduction_sets_extra_non_negative CHECK (entitlement_extra_size >= 0)
);

create table introductions (
  id uuid primary key,
  set_id uuid not null references introduction_sets(id),
  recipient_group_id uuid NOT NULL references groups(id),
  kind text not null,
  target_group_id uuid references groups(id),
  target_plan_id uuid references plans(id),
  status text not null,
  rank_position integer not null,
  score numeric(6,4) not null,
  reason_codes text[] not null default '{}',
  shown_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint introductions_target_xor CHECK ((target_group_id IS NOT NULL AND target_plan_id IS NULL) OR (target_group_id IS NULL AND target_plan_id IS NOT NULL))
);

create table introduction_decisions (
  id uuid primary key,
  introduction_id uuid not null references introductions(id),
  group_id uuid not null references groups(id),
  member_id uuid not null references members(id),
  decision_type text not null,
  reason_code text,
  created_at timestamptz not null default now(),
  constraint introduction_decisions_unique_member_type unique (introduction_id, member_id, decision_type)
);

create table conversation_groups (
  conversation_id uuid not null references conversations(id),
  group_id uuid not null references groups(id),
  role text not null,
  joined_at timestamptz not null,
  left_at timestamptz,
  PRIMARY KEY (conversation_id, group_id)
);

create table conversation_participants (
  conversation_id uuid not null references conversations(id),
  member_id uuid not null references members(id),
  group_id uuid not null references groups(id),
  can_write boolean not null,
  last_read_message_id uuid,
  joined_at timestamptz not null,
  left_at timestamptz,
  primary key (conversation_id, member_id)
);

create table messages (
  id uuid primary key,
  conversation_id uuid not null references conversations(id),
  sender_member_id uuid not null references members(id),
  sender_group_id uuid not null references groups(id),
  body text,
  media_asset_ids uuid[] not null default '{}',
  moderation_status text not null,
  client_nonce text not null,
  sequence_number bigint not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint messages_conversation_sequence_key unique (conversation_id, sequence_number),
  constraint messages_sender_nonce_key unique (sender_member_id, client_nonce)
);

create table breakout_requests (
  id uuid primary key,
  parent_conversation_id uuid NOT NULL REFERENCES conversations(id),
  requester_member_id uuid not null references members(id),
  recipient_member_id uuid not null references members(id),
  requester_group_id uuid not null references groups(id),
  recipient_group_id uuid not null references groups(id),
  status text not null,
  eligibility_reason text not null,
  created_conversation_id uuid references conversations(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table plan_groups (
  plan_id uuid not null references plans(id),
  group_id uuid not null references groups(id),
  role text not null,
  status text not null,
  joined_at timestamptz not null,
  removed_at timestamptz,
  PRIMARY KEY (plan_id, group_id)
);

create table plan_options (
  id uuid primary key,
  plan_id uuid not null references plans(id),
  option_type text not null,
  venue_id uuid references venues(id),
  manual_label text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by_member_id uuid not null references members(id),
  created_at timestamptz not null default now()
);

create table plan_votes (
  id uuid primary key,
  plan_id uuid not null references plans(id),
  option_id uuid not null references plan_options(id),
  member_id uuid not null references members(id),
  group_id uuid not null references groups(id),
  vote_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_votes_unique_member_option unique (member_id, option_id)
);

create table plan_rsvps (
  id uuid primary key,
  plan_id uuid not null references plans(id),
  member_id uuid not null references members(id),
  group_id uuid not null references groups(id),
  status text not null,
  reason_code text,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_rsvps_unique_plan_member unique (plan_id, member_id)
);

create table trusted_contact_shares (
  id uuid primary key,
  plan_id uuid not null references plans(id),
  member_id uuid not null references members(id),
  contact_label text not null,
  contact_channel_hash text not null,
  delivery_status text not null,
  shared_at timestamptz,
  created_at timestamptz not null default now()
);

create table attendance_confirmations (
  id uuid primary key,
  plan_id uuid not null references plans(id),
  member_id uuid not null references members(id),
  group_id uuid not null references groups(id),
  status text not null,
  source text not null,
  confidence numeric(5,4) not null,
  reason_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_confirmations_unique_plan_member_source unique (plan_id, member_id, source)
);

create table debriefs (
  id uuid primary key,
  plan_id uuid not null references plans(id),
  member_id uuid not null references members(id),
  group_id uuid not null references groups(id),
  attendance_status text not null,
  quality_rating integer,
  safety_concern boolean not null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint debriefs_unique_plan_member unique (plan_id, member_id)
);

create table mutual_edges (
  id uuid primary key,
  plan_id uuid not null references plans(id),
  member_a_id uuid not null references members(id),
  member_b_id uuid not null references members(id),
  edge_type text not null,
  revealed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint mutual_edges_unique_plan_pair unique (plan_id, member_a_id, member_b_id)
);

create table debrief_interests (
  id uuid primary key,
  debrief_id uuid not null references debriefs(id),
  plan_id uuid not null references plans(id),
  source_member_id uuid not null references members(id),
  target_member_id uuid not null references members(id),
  signal text not null,
  visibility_status text NOT NULL DEFAULT 'private',
  mutual_edge_id uuid references mutual_edges(id),
  created_at timestamptz not null default now(),
  constraint debrief_interests_private_default check (visibility_status in ('private', 'mutual_revealed', 'suppressed')),
  constraint debrief_interests_unique_pair_plan unique (plan_id, source_member_id, target_member_id)
);

CREATE TABLE debrief_learning_consents (
  id uuid primary key,
  debrief_id uuid NOT NULL REFERENCES debriefs(id),
  plan_id uuid NOT NULL REFERENCES plans(id),
  member_id uuid NOT NULL REFERENCES members(id),
  group_id uuid NOT NULL REFERENCES groups(id),
  status text NOT NULL,
  source text NOT NULL,
  granted_at timestamptz,
  declined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint debrief_learning_consents_unique_debrief_member unique (debrief_id, member_id)
);

CREATE TABLE recommendation_feature_snapshots (
  id uuid primary key,
  consent_id uuid NOT NULL REFERENCES debrief_learning_consents(id),
  debrief_id uuid NOT NULL REFERENCES debriefs(id),
  plan_id uuid NOT NULL REFERENCES plans(id),
  member_id uuid NOT NULL REFERENCES members(id),
  group_id uuid NOT NULL REFERENCES groups(id),
  feature_version text NOT NULL,
  feature_payload jsonb NOT NULL,
  active boolean NOT NULL default true,
  expires_at timestamptz NOT NULL,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create table safety_reports (
  id uuid primary key,
  reporter_member_id uuid not null references members(id),
  reporter_group_id uuid references groups(id),
  target_member_id uuid references members(id),
  target_group_id uuid references groups(id),
  target_conversation_id uuid references conversations(id),
  target_plan_id uuid references plans(id),
  target_venue_id uuid references venues(id),
  surface text not null,
  category text not null,
  severity text not null,
  narrative text,
  evidence_media_asset_ids uuid[] not null default '{}',
  status text not null,
  protective_action_applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table safety_actions (
  id uuid primary key,
  report_id uuid references safety_reports(id),
  action_type text not null,
  target_member_id uuid references members(id),
  target_group_id uuid references groups(id),
  target_conversation_id uuid references conversations(id),
  target_plan_id uuid references plans(id),
  status text not null,
  applied_by text not null,
  applied_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table consensus_block_votes (
  id uuid primary key,
  acting_group_id uuid not null references groups(id),
  voter_member_id uuid not null references members(id),
  target_member_id uuid references members(id),
  target_group_id uuid references groups(id),
  reason_code text,
  created_at timestamptz not null default now(),
  constraint consensus_block_votes_unique_group_voter_target unique (acting_group_id, voter_member_id, target_member_id, target_group_id)
);

create table blocks (
  id uuid primary key,
  source_group_id uuid not null references groups(id),
  source_member_id uuid references members(id),
  target_member_id uuid references members(id),
  target_group_id uuid references groups(id),
  block_scope text not null,
  created_from text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table moderation_cases (
  id uuid primary key,
  source_type text not null,
  source_id uuid not null,
  severity text not null,
  status text not null,
  classifier_scores jsonb not null default '{}',
  assigned_reviewer_id uuid,
  decision text,
  decision_reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

CREATE TABLE action_queue_items (
  id uuid primary key,
  member_id uuid NOT NULL REFERENCES members(id),
  group_id uuid REFERENCES groups(id),
  source_event_id uuid NOT NULL REFERENCES domain_event_outbox(id),
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  action_kind text NOT NULL,
  priority text NOT NULL,
  deadline_at timestamptz,
  status text NOT NULL,
  dismissible boolean NOT NULL default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  dismissed_at timestamptz,
  expired_at timestamptz,
  constraint action_queue_items_source_target_member_key unique (source_event_id, member_id, target_type, target_id)
);

create table notification_preferences (
  member_id uuid primary key references members(id),
  enabled_categories text[] not null default '{}',
  quiet_hours_start time,
  quiet_hours_end time,
  lockscreen_privacy text not null,
  push_token_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table notification_intents (
  id uuid primary key,
  source_event_id uuid NOT NULL REFERENCES domain_event_outbox(id),
  member_id uuid not null references members(id),
  group_id uuid references groups(id),
  category text not null,
  template_key text not null,
  delivery_status text not null,
  dedupe_key text NOT NULL UNIQUE,
  send_after timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_intents_source_event_required check (source_event_id is not null)
);

CREATE TABLE audit_logs (
  id uuid primary key,
  actor_type text not null,
  actor_id text,
  action text not null,
  target_type text not null,
  target_id uuid,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table idempotency_keys (
  id uuid primary key,
  route_key text not null,
  idempotency_key text not null,
  actor_member_id uuid references members(id),
  request_hash text not null,
  response_hash text,
  status text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table provider_webhook_events (
  id uuid primary key,
  provider text not null,
  provider_event_id text not null,
  signature_verified_at timestamptz not null,
  idempotency_key text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

CREATE UNIQUE INDEX idempotency_keys_route_key ON idempotency_keys(route_key, idempotency_key);
CREATE UNIQUE INDEX group_readiness_snapshots_group_member_key ON group_readiness_snapshots(group_id, member_id);
CREATE INDEX idx_group_availability_snapshots_group_window ON group_availability_snapshots(group_id, window_start, window_end);
CREATE INDEX idx_vouch_blurbs_group_visible ON vouch_blurbs(group_id) WHERE hidden_at IS NULL;
CREATE INDEX idx_vouch_blurbs_subject ON vouch_blurbs(subject_member_id);
CREATE INDEX idx_vouch_blurbs_moderation_status ON vouch_blurbs(moderation_status);
CREATE INDEX idx_action_queue_items_member_status_deadline ON action_queue_items(member_id, status, deadline_at);
CREATE UNIQUE INDEX provider_webhook_events_provider_event_key ON provider_webhook_events(provider, provider_event_id);
`;
