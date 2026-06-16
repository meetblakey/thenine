import { getTableName, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const cities = pgTable(
  "cities",
  {
    id: uuid("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    countryCode: text("country_code").notNull(),
    timezone: text("timezone").notNull(),
    launchStatus: text("launch_status").notNull(),
    createdAt,
    updatedAt
  },
  (table) => [uniqueIndex("cities_slug_key").on(table.slug), index("idx_cities_launch_status").on(table.launchStatus)]
);

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey(),
    authSubject: text("auth_subject").notNull(),
    email: text("email"),
    phoneE164: text("phone_e164"),
    firstName: text("first_name").notNull(),
    dateOfBirth: date("date_of_birth"),
    ageBand: text("age_band"),
    pronouns: text("pronouns"),
    cityId: uuid("city_id").notNull().references(() => cities.id),
    status: text("status").notNull(),
    verificationStatus: text("verification_status").notNull(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("members_auth_subject_key").on(table.authSubject),
    uniqueIndex("members_email_key").on(table.email).where(sql`${table.email} is not null`),
    uniqueIndex("members_phone_key").on(table.phoneE164).where(sql`${table.phoneE164} is not null`),
    index("idx_members_city_status").on(table.cityId, table.status),
    index("idx_members_verification_status").on(table.verificationStatus)
  ]
);

export const verificationCases = pgTable(
  "verification_cases",
  {
    id: uuid("id").primaryKey(),
    memberId: uuid("member_id").notNull().references(() => members.id),
    provider: text("provider").notNull().default("persona"),
    providerInquiryId: text("provider_inquiry_id").notNull(),
    status: text("status").notNull(),
    failureReasonCode: text("failure_reason_code"),
    appealStatus: text("appeal_status"),
    riskFlags: text("risk_flags").array().notNull().default(sql`'{}'::text[]`),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt,
    updatedAt
  },
  (table) => [
    uniqueIndex("verification_cases_provider_inquiry_id_key").on(table.providerInquiryId),
    index("idx_verification_cases_member_status").on(table.memberId, table.status),
    index("idx_verification_cases_verified_at").on(table.verifiedAt)
  ]
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey(),
    cityId: uuid("city_id").notNull().references(() => cities.id),
    format: text("format").notNull(),
    status: text("status").notNull(),
    name: text("name"),
    intent: text("intent"),
    neighborhoodIds: uuid("neighborhood_ids").array().notNull().default(sql`'{}'::uuid[]`),
    availabilityWindows: jsonb("availability_windows").notNull().default(sql`'[]'::jsonb`),
    publishApprovedAt: timestamp("publish_approved_at", { withTimezone: true }),
    eligibilityStatus: text("eligibility_status").notNull(),
    eligibilityBlockers: text("eligibility_blockers").array().notNull().default(sql`'{}'::text[]`),
    distributionFloorVersion: integer("distribution_floor_version").notNull().default(1),
    createdByMemberId: uuid("created_by_member_id").notNull().references(() => members.id),
    createdAt,
    updatedAt,
    dissolvedAt: timestamp("dissolved_at", { withTimezone: true })
  },
  (table) => [
    index("idx_groups_city_status_format").on(table.cityId, table.status, table.format),
    index("idx_groups_eligible_city").on(table.cityId).where(sql`${table.status} = 'eligible'`),
    index("idx_groups_created_by_member_id").on(table.createdByMemberId)
  ]
);

export const groupMemberships = pgTable(
  "group_memberships",
  {
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    role: text("role").notNull(),
    status: text("status").notNull(),
    publishApprovedAt: timestamp("publish_approved_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    leftAt: timestamp("left_at", { withTimezone: true }),
    leaveReasonCode: text("leave_reason_code"),
    createdAt,
    updatedAt
  },
  (table) => [
    uniqueIndex("group_memberships_group_member_key").on(table.groupId, table.memberId),
    index("idx_group_memberships_member_active").on(table.memberId).where(sql`${table.status} = 'active'`),
    index("idx_group_memberships_group_status").on(table.groupId, table.status)
  ]
);

export const groupInvites = pgTable(
  "group_invites",
  {
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    inviterMemberId: uuid("inviter_member_id").notNull().references(() => members.id),
    tokenHash: text("token_hash").notNull(),
    recipientHintHash: text("recipient_hint_hash"),
    status: text("status").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedByMemberId: uuid("accepted_by_member_id").references(() => members.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt,
    updatedAt
  },
  (table) => [
    uniqueIndex("group_invites_token_hash_key").on(table.tokenHash),
    index("idx_group_invites_group_status").on(table.groupId, table.status)
  ]
);

export const inviteRelayEvents = pgTable(
  "invite_relay_events",
  {
    id: uuid("id").primaryKey(),
    inviteId: uuid("invite_id").notNull().references(() => groupInvites.id),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    eventType: text("event_type").notNull(),
    sourceChannel: text("source_channel").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt
  },
  (table) => [
    index("idx_invite_relay_events_invite").on(table.inviteId, table.occurredAt),
    index("idx_invite_relay_events_group_type").on(table.groupId, table.eventType)
  ]
);

export const groupProfiles = pgTable(
  "group_profiles",
  {
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    sharedVibe: text("shared_vibe"),
    promptAnswers: jsonb("prompt_answers").notNull().default(sql`'{}'::jsonb`),
    memberCards: jsonb("member_cards").notNull().default(sql`'[]'::jsonb`),
    visibilityPreviewHash: text("visibility_preview_hash"),
    moderationStatus: text("moderation_status").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt,
    updatedAt
  },
  (table) => [uniqueIndex("group_profiles_group_id_key").on(table.groupId), index("idx_group_profiles_moderation_status").on(table.moderationStatus)]
);

export const vouchBlurbs = pgTable(
  "vouch_blurbs",
  {
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    authorMemberId: uuid("author_member_id").notNull().references(() => members.id),
    subjectMemberId: uuid("subject_member_id").notNull().references(() => members.id),
    body: text("body").notNull(),
    subjectApprovedAt: timestamp("subject_approved_at", { withTimezone: true }),
    moderationStatus: text("moderation_status").notNull(),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt,
    updatedAt
  },
  (table) => [
    index("idx_vouch_blurbs_group_visible").on(table.groupId).where(sql`${table.hiddenAt} is null`),
    index("idx_vouch_blurbs_subject").on(table.subjectMemberId),
    index("idx_vouch_blurbs_moderation_status").on(table.moderationStatus)
  ]
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey(),
    ownerMemberId: uuid("owner_member_id").references(() => members.id),
    ownerGroupId: uuid("owner_group_id").references(() => groups.id),
    purpose: text("purpose").notNull(),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    moderationStatus: text("moderation_status").notNull(),
    retentionClass: text("retention_class").notNull(),
    createdAt,
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("media_assets_object_key_key").on(table.objectKey),
    index("idx_media_assets_owner_member").on(table.ownerMemberId),
    index("idx_media_assets_owner_group").on(table.ownerGroupId)
  ]
);

export const domainEventOutbox = pgTable(
  "domain_event_outbox",
  {
    id: uuid("id").primaryKey(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    eventName: text("event_name").notNull(),
    eventVersion: integer("event_version").notNull(),
    sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
    payload: jsonb("payload").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt
  },
  (table) => [
    uniqueIndex("domain_event_outbox_aggregate_sequence_key").on(table.aggregateType, table.aggregateId, table.sequenceNumber),
    index("idx_domain_event_outbox_unpublished").on(table.createdAt).where(sql`${table.publishedAt} is null`),
    index("idx_domain_event_outbox_event_name").on(table.eventName)
  ]
);

export const groupReadinessSnapshots = pgTable(
  "group_readiness_snapshots",
  {
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    readinessStatus: text("readiness_status").notNull(),
    blockers: text("blockers").array().notNull().default(sql`'{}'::text[]`),
    nextAction: text("next_action").notNull(),
    secondaryActions: text("secondary_actions").array().notNull().default(sql`'{}'::text[]`),
    sourceEventId: uuid("source_event_id").notNull().references(() => domainEventOutbox.id),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
    createdAt,
    updatedAt
  },
  (table) => [
    uniqueIndex("group_readiness_snapshots_group_member_key").on(table.groupId, table.memberId),
    index("idx_group_readiness_snapshots_source_event").on(table.sourceEventId),
    index("idx_group_readiness_snapshots_computed_at").on(table.computedAt)
  ]
);

export const groupAvailabilitySnapshots = pgTable(
  "group_availability_snapshots",
  {
    id: uuid("id").primaryKey(),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),
    source: text("source").notNull(),
    confirmedByMemberIds: uuid("confirmed_by_member_ids").array().notNull().default(sql`'{}'::uuid[]`),
    sourceEventId: uuid("source_event_id").notNull().references(() => domainEventOutbox.id),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
    createdAt,
    updatedAt
  },
  (table) => [
    index("idx_group_availability_snapshots_group_window").on(table.groupId, table.windowStart, table.windowEnd),
    index("idx_group_availability_snapshots_source_event").on(table.sourceEventId)
  ]
);

export const venues = pgTable(
  "venues",
  {
    id: uuid("id").primaryKey(),
    cityId: uuid("city_id").notNull().references(() => cities.id),
    name: text("name").notNull(),
    addressLine: text("address_line").notNull(),
    neighborhoodId: uuid("neighborhood_id"),
    venueType: text("venue_type").notNull(),
    safetyStatus: text("safety_status").notNull(),
    partnerStatus: text("partner_status").notNull(),
    createdAt,
    updatedAt
  },
  (table) => [index("idx_venues_city_type").on(table.cityId, table.venueType), index("idx_venues_safety_status").on(table.safetyStatus)]
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    sourceIntroductionId: uuid("source_introduction_id"),
    parentConversationId: uuid("parent_conversation_id"),
    createdByMemberId: uuid("created_by_member_id").references(() => members.id),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt,
    updatedAt
  },
  (table) => [index("idx_conversations_source_introduction").on(table.sourceIntroductionId), index("idx_conversations_parent").on(table.parentConversationId)]
);

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey(),
    conversationId: uuid("conversation_id").references(() => conversations.id),
    cityId: uuid("city_id").notNull().references(() => cities.id),
    format: text("format").notNull(),
    status: text("status").notNull(),
    venueId: uuid("venue_id").references(() => venues.id),
    manualVenueName: text("manual_venue_name"),
    manualVenueAddress: text("manual_venue_address"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    rsvpDeadlineAt: timestamp("rsvp_deadline_at", { withTimezone: true }),
    confirmationRule: text("confirmation_rule").notNull(),
    hostMemberId: uuid("host_member_id").references(() => members.id),
    canceledReasonCode: text("canceled_reason_code"),
    createdByMemberId: uuid("created_by_member_id").notNull().references(() => members.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt,
    updatedAt
  },
  (table) => [
    index("idx_plans_city_status_starts").on(table.cityId, table.status, table.startsAt),
    index("idx_plans_conversation").on(table.conversationId),
    index("idx_plans_completed_at").on(table.completedAt)
  ]
);

export const planFastTrackProposals = pgTable(
  "plan_fast_track_proposals",
  {
    id: uuid("id").primaryKey(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
    createdByMemberId: uuid("created_by_member_id").notNull().references(() => members.id),
    sourceGroupId: uuid("source_group_id").notNull().references(() => groups.id),
    proposalState: text("proposal_state").notNull(),
    format: text("format").notNull(),
    timeOptions: jsonb("time_options").notNull(),
    venueOptions: jsonb("venue_options").notNull(),
    safetyContext: jsonb("safety_context").notNull(),
    acceptedPlanId: uuid("accepted_plan_id").references(() => plans.id),
    createdAt,
    updatedAt,
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true })
  },
  (table) => [
    index("idx_plan_fast_track_proposals_conversation_state").on(table.conversationId, table.proposalState),
    index("idx_plan_fast_track_proposals_source_group").on(table.sourceGroupId),
    index("idx_plan_fast_track_proposals_created_by").on(table.createdByMemberId)
  ]
);

export const introductionSets = pgTable(
  "introduction_sets",
  {
    id: uuid("id").primaryKey(),
    recipientGroupId: uuid("recipient_group_id").notNull().references(() => groups.id),
    cityId: uuid("city_id").notNull().references(() => cities.id),
    setDate: date("set_date").notNull(),
    format: text("format").notNull(),
    baselineSize: integer("baseline_size").notNull(),
    entitlementExtraSize: integer("entitlement_extra_size").notNull(),
    liquidityMode: text("liquidity_mode").notNull(),
    generatedByRunId: uuid("generated_by_run_id").notNull(),
    createdAt,
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
  },
  (table) => [
    uniqueIndex("introduction_sets_group_date_format_key").on(table.recipientGroupId, table.setDate, table.format),
    index("idx_introduction_sets_city_date").on(table.cityId, table.setDate),
    index("idx_introduction_sets_expires_at").on(table.expiresAt)
  ]
);

export const introductions = pgTable(
  "introductions",
  {
    id: uuid("id").primaryKey(),
    setId: uuid("set_id").notNull().references(() => introductionSets.id),
    recipientGroupId: uuid("recipient_group_id").notNull().references(() => groups.id),
    kind: text("kind").notNull(),
    targetGroupId: uuid("target_group_id").references(() => groups.id),
    targetPlanId: uuid("target_plan_id").references(() => plans.id),
    status: text("status").notNull(),
    rankPosition: integer("rank_position").notNull(),
    score: numeric("score", { precision: 6, scale: 4 }).notNull(),
    reasonCodes: text("reason_codes").array().notNull().default(sql`'{}'::text[]`),
    shownAt: timestamp("shown_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt,
    updatedAt
  },
  (table) => [
    index("idx_introductions_recipient_status").on(table.recipientGroupId, table.status),
    index("idx_introductions_target_group").on(table.targetGroupId),
    index("idx_introductions_target_plan").on(table.targetPlanId),
    index("idx_introductions_set_rank").on(table.setId, table.rankPosition),
    uniqueIndex("introductions_no_duplicate_group_target")
      .on(table.recipientGroupId, table.targetGroupId, table.setId)
      .where(sql`${table.targetGroupId} is not null`)
  ]
);

export const introductionDecisions = pgTable(
  "introduction_decisions",
  {
    id: uuid("id").primaryKey(),
    introductionId: uuid("introduction_id").notNull().references(() => introductions.id),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    decisionType: text("decision_type").notNull(),
    reasonCode: text("reason_code"),
    createdAt
  },
  (table) => [
    index("idx_introduction_decisions_intro").on(table.introductionId),
    index("idx_introduction_decisions_group_member").on(table.groupId, table.memberId),
    uniqueIndex("introduction_decisions_unique_member_type").on(table.introductionId, table.memberId, table.decisionType)
  ]
);

export const conversationGroups = pgTable(
  "conversation_groups",
  {
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    role: text("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
    leftAt: timestamp("left_at", { withTimezone: true })
  },
  (table) => [primaryKey({ columns: [table.conversationId, table.groupId] }), index("idx_conversation_groups_group").on(table.groupId)]
);

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    canWrite: boolean("can_write").notNull(),
    lastReadMessageId: uuid("last_read_message_id"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
    leftAt: timestamp("left_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.memberId] }),
    index("idx_conversation_participants_member").on(table.memberId),
    index("idx_conversation_participants_group").on(table.groupId)
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
    senderMemberId: uuid("sender_member_id").notNull().references(() => members.id),
    senderGroupId: uuid("sender_group_id").notNull().references(() => groups.id),
    body: text("body"),
    mediaAssetIds: uuid("media_asset_ids").array().notNull().default(sql`'{}'::uuid[]`),
    moderationStatus: text("moderation_status").notNull(),
    clientNonce: text("client_nonce").notNull(),
    sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
    createdAt,
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("messages_conversation_sequence_key").on(table.conversationId, table.sequenceNumber),
    uniqueIndex("messages_sender_nonce_key").on(table.senderMemberId, table.clientNonce),
    index("idx_messages_moderation_status").on(table.moderationStatus)
  ]
);

export const breakoutRequests = pgTable(
  "breakout_requests",
  {
    id: uuid("id").primaryKey(),
    parentConversationId: uuid("parent_conversation_id").notNull().references(() => conversations.id),
    requesterMemberId: uuid("requester_member_id").notNull().references(() => members.id),
    recipientMemberId: uuid("recipient_member_id").notNull().references(() => members.id),
    requesterGroupId: uuid("requester_group_id").notNull().references(() => groups.id),
    recipientGroupId: uuid("recipient_group_id").notNull().references(() => groups.id),
    status: text("status").notNull(),
    eligibilityReason: text("eligibility_reason").notNull(),
    createdConversationId: uuid("created_conversation_id").references(() => conversations.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt,
    respondedAt: timestamp("responded_at", { withTimezone: true })
  },
  (table) => [index("idx_breakout_requests_recipient_status").on(table.recipientMemberId, table.status), index("idx_breakout_requests_parent").on(table.parentConversationId)]
);

export const planGroups = pgTable(
  "plan_groups",
  {
    planId: uuid("plan_id").notNull().references(() => plans.id),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    role: text("role").notNull(),
    status: text("status").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
    removedAt: timestamp("removed_at", { withTimezone: true })
  },
  (table) => [primaryKey({ columns: [table.planId, table.groupId] }), index("idx_plan_groups_group").on(table.groupId), index("idx_plan_groups_status").on(table.status)]
);

export const planOptions = pgTable(
  "plan_options",
  {
    id: uuid("id").primaryKey(),
    planId: uuid("plan_id").notNull().references(() => plans.id),
    optionType: text("option_type").notNull(),
    venueId: uuid("venue_id").references(() => venues.id),
    manualLabel: text("manual_label"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdByMemberId: uuid("created_by_member_id").notNull().references(() => members.id),
    createdAt
  },
  (table) => [index("idx_plan_options_plan_type").on(table.planId, table.optionType), index("idx_plan_options_venue").on(table.venueId)]
);

export const planVotes = pgTable(
  "plan_votes",
  {
    id: uuid("id").primaryKey(),
    planId: uuid("plan_id").notNull().references(() => plans.id),
    optionId: uuid("option_id").notNull().references(() => planOptions.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    voteValue: text("vote_value").notNull(),
    createdAt,
    updatedAt
  },
  (table) => [uniqueIndex("plan_votes_unique_member_option").on(table.memberId, table.optionId), index("idx_plan_votes_plan_group").on(table.planId, table.groupId)]
);

export const planRsvps = pgTable(
  "plan_rsvps",
  {
    id: uuid("id").primaryKey(),
    planId: uuid("plan_id").notNull().references(() => plans.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    status: text("status").notNull(),
    reasonCode: text("reason_code"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt,
    updatedAt
  },
  (table) => [uniqueIndex("plan_rsvps_unique_plan_member").on(table.planId, table.memberId), index("idx_plan_rsvps_group_status").on(table.groupId, table.status)]
);

export const trustedContactShares = pgTable(
  "trusted_contact_shares",
  {
    id: uuid("id").primaryKey(),
    planId: uuid("plan_id").notNull().references(() => plans.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    contactLabel: text("contact_label").notNull(),
    contactChannelHash: text("contact_channel_hash").notNull(),
    deliveryStatus: text("delivery_status").notNull(),
    sharedAt: timestamp("shared_at", { withTimezone: true }),
    createdAt
  },
  (table) => [index("idx_trusted_contact_shares_plan").on(table.planId), index("idx_trusted_contact_shares_member").on(table.memberId)]
);

export const attendanceConfirmations = pgTable(
  "attendance_confirmations",
  {
    id: uuid("id").primaryKey(),
    planId: uuid("plan_id").notNull().references(() => plans.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    status: text("status").notNull(),
    source: text("source").notNull(),
    confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
    reasonCode: text("reason_code"),
    createdAt,
    updatedAt
  },
  (table) => [uniqueIndex("attendance_confirmations_unique_plan_member_source").on(table.planId, table.memberId, table.source)]
);

export const debriefs = pgTable(
  "debriefs",
  {
    id: uuid("id").primaryKey(),
    planId: uuid("plan_id").notNull().references(() => plans.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    attendanceStatus: text("attendance_status").notNull(),
    qualityRating: integer("quality_rating"),
    safetyConcern: boolean("safety_concern").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt,
    updatedAt
  },
  (table) => [uniqueIndex("debriefs_unique_plan_member").on(table.planId, table.memberId), index("idx_debriefs_safety_concern").on(table.safetyConcern)]
);

export const mutualEdges = pgTable(
  "mutual_edges",
  {
    id: uuid("id").primaryKey(),
    planId: uuid("plan_id").notNull().references(() => plans.id),
    memberAId: uuid("member_a_id").notNull().references(() => members.id),
    memberBId: uuid("member_b_id").notNull().references(() => members.id),
    edgeType: text("edge_type").notNull(),
    revealedAt: timestamp("revealed_at", { withTimezone: true }).notNull(),
    createdAt
  },
  (table) => [uniqueIndex("mutual_edges_unique_plan_pair").on(table.planId, table.memberAId, table.memberBId)]
);

export const debriefInterests = pgTable(
  "debrief_interests",
  {
    id: uuid("id").primaryKey(),
    debriefId: uuid("debrief_id").notNull().references(() => debriefs.id),
    planId: uuid("plan_id").notNull().references(() => plans.id),
    sourceMemberId: uuid("source_member_id").notNull().references(() => members.id),
    targetMemberId: uuid("target_member_id").notNull().references(() => members.id),
    signal: text("signal").notNull(),
    visibilityStatus: text("visibility_status").notNull().default("private"),
    mutualEdgeId: uuid("mutual_edge_id").references(() => mutualEdges.id),
    createdAt
  },
  (table) => [uniqueIndex("debrief_interests_unique_pair_plan").on(table.planId, table.sourceMemberId, table.targetMemberId)]
);

export const debriefLearningConsents = pgTable(
  "debrief_learning_consents",
  {
    id: uuid("id").primaryKey(),
    debriefId: uuid("debrief_id").notNull().references(() => debriefs.id),
    planId: uuid("plan_id").notNull().references(() => plans.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    status: text("status").notNull(),
    source: text("source").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt,
    updatedAt
  },
  (table) => [
    uniqueIndex("debrief_learning_consents_unique_debrief_member").on(table.debriefId, table.memberId),
    index("idx_debrief_learning_consents_member_status").on(table.memberId, table.status),
    index("idx_debrief_learning_consents_plan_group").on(table.planId, table.groupId)
  ]
);

export const recommendationFeatureSnapshots = pgTable(
  "recommendation_feature_snapshots",
  {
    id: uuid("id").primaryKey(),
    consentId: uuid("consent_id").notNull().references(() => debriefLearningConsents.id),
    debriefId: uuid("debrief_id").notNull().references(() => debriefs.id),
    planId: uuid("plan_id").notNull().references(() => plans.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    featureVersion: text("feature_version").notNull(),
    featurePayload: jsonb("feature_payload").notNull(),
    active: boolean("active").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt,
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true })
  },
  (table) => [
    index("idx_recommendation_feature_snapshots_member_active").on(table.memberId, table.active),
    index("idx_recommendation_feature_snapshots_group_active").on(table.groupId, table.active),
    index("idx_recommendation_feature_snapshots_expiry").on(table.expiresAt)
  ]
);

export const safetyReports = pgTable(
  "safety_reports",
  {
    id: uuid("id").primaryKey(),
    reporterMemberId: uuid("reporter_member_id").notNull().references(() => members.id),
    reporterGroupId: uuid("reporter_group_id").references(() => groups.id),
    targetMemberId: uuid("target_member_id").references(() => members.id),
    targetGroupId: uuid("target_group_id").references(() => groups.id),
    targetConversationId: uuid("target_conversation_id").references(() => conversations.id),
    targetPlanId: uuid("target_plan_id").references(() => plans.id),
    targetVenueId: uuid("target_venue_id").references(() => venues.id),
    surface: text("surface").notNull(),
    category: text("category").notNull(),
    severity: text("severity").notNull(),
    narrative: text("narrative"),
    evidenceMediaAssetIds: uuid("evidence_media_asset_ids").array().notNull().default(sql`'{}'::uuid[]`),
    status: text("status").notNull(),
    protectiveActionAppliedAt: timestamp("protective_action_applied_at", { withTimezone: true }),
    createdAt,
    updatedAt
  },
  (table) => [
    index("idx_safety_reports_reporter").on(table.reporterMemberId),
    index("idx_safety_reports_target_group").on(table.targetGroupId),
    index("idx_safety_reports_plan").on(table.targetPlanId)
  ]
);

export const safetyActions = pgTable(
  "safety_actions",
  {
    id: uuid("id").primaryKey(),
    reportId: uuid("report_id").references(() => safetyReports.id),
    actionType: text("action_type").notNull(),
    targetMemberId: uuid("target_member_id").references(() => members.id),
    targetGroupId: uuid("target_group_id").references(() => groups.id),
    targetConversationId: uuid("target_conversation_id").references(() => conversations.id),
    targetPlanId: uuid("target_plan_id").references(() => plans.id),
    status: text("status").notNull(),
    appliedBy: text("applied_by").notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt
  },
  (table) => [index("idx_safety_actions_report").on(table.reportId), index("idx_safety_actions_target_group").on(table.targetGroupId)]
);

export const consensusBlockVotes = pgTable(
  "consensus_block_votes",
  {
    id: uuid("id").primaryKey(),
    actingGroupId: uuid("acting_group_id").notNull().references(() => groups.id),
    voterMemberId: uuid("voter_member_id").notNull().references(() => members.id),
    targetMemberId: uuid("target_member_id").references(() => members.id),
    targetGroupId: uuid("target_group_id").references(() => groups.id),
    reasonCode: text("reason_code"),
    createdAt
  },
  (table) => [
    uniqueIndex("consensus_block_votes_unique_group_voter_target").on(
      table.actingGroupId,
      table.voterMemberId,
      table.targetMemberId,
      table.targetGroupId
    )
  ]
);

export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").primaryKey(),
    sourceGroupId: uuid("source_group_id").notNull().references(() => groups.id),
    sourceMemberId: uuid("source_member_id").references(() => members.id),
    targetMemberId: uuid("target_member_id").references(() => members.id),
    targetGroupId: uuid("target_group_id").references(() => groups.id),
    blockScope: text("block_scope").notNull(),
    createdFrom: text("created_from").notNull(),
    createdAt,
    revokedAt: timestamp("revoked_at", { withTimezone: true })
  },
  (table) => [index("idx_blocks_source_group").on(table.sourceGroupId), index("idx_blocks_active").on(table.createdAt).where(sql`${table.revokedAt} is null`)]
);

export const moderationCases = pgTable(
  "moderation_cases",
  {
    id: uuid("id").primaryKey(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    severity: text("severity").notNull(),
    status: text("status").notNull(),
    classifierScores: jsonb("classifier_scores").notNull().default(sql`'{}'::jsonb`),
    assignedReviewerId: uuid("assigned_reviewer_id"),
    decision: text("decision"),
    decisionReason: text("decision_reason"),
    createdAt,
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
  },
  (table) => [
    index("idx_moderation_cases_status_severity").on(table.status, table.severity),
    index("idx_moderation_cases_source").on(table.sourceType, table.sourceId)
  ]
);

export const actionQueueItems = pgTable(
  "action_queue_items",
  {
    id: uuid("id").primaryKey(),
    memberId: uuid("member_id").notNull().references(() => members.id),
    groupId: uuid("group_id").references(() => groups.id),
    sourceEventId: uuid("source_event_id").notNull().references(() => domainEventOutbox.id),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    actionKind: text("action_kind").notNull(),
    priority: text("priority").notNull(),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    status: text("status").notNull(),
    dismissible: boolean("dismissible").notNull().default(false),
    createdAt,
    updatedAt,
    completedAt: timestamp("completed_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true })
  },
  (table) => [
    index("idx_action_queue_items_member_status_deadline").on(table.memberId, table.status, table.deadlineAt),
    index("idx_action_queue_items_group_status").on(table.groupId, table.status),
    uniqueIndex("action_queue_items_source_target_member_key").on(table.sourceEventId, table.memberId, table.targetType, table.targetId)
  ]
);

export const notificationPreferences = pgTable("notification_preferences", {
  memberId: uuid("member_id").primaryKey().references(() => members.id),
  enabledCategories: text("enabled_categories").array().notNull().default(sql`'{}'::text[]`),
  quietHoursStart: time("quiet_hours_start"),
  quietHoursEnd: time("quiet_hours_end"),
  lockscreenPrivacy: text("lockscreen_privacy").notNull(),
  pushTokenCount: integer("push_token_count").notNull().default(0),
  updatedAt
});

export const notificationIntents = pgTable(
  "notification_intents",
  {
    id: uuid("id").primaryKey(),
    sourceEventId: uuid("source_event_id").notNull().references(() => domainEventOutbox.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    groupId: uuid("group_id").references(() => groups.id),
    category: text("category").notNull(),
    templateKey: text("template_key").notNull(),
    deliveryStatus: text("delivery_status").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    sendAfter: timestamp("send_after", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt
  },
  (table) => [uniqueIndex("notification_intents_dedupe_key_key").on(table.dedupeKey), index("idx_notification_intents_member_status").on(table.memberId, table.deliveryStatus)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    ipHash: text("ip_hash"),
    userAgentHash: text("user_agent_hash"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt
  },
  (table) => [index("idx_audit_logs_actor").on(table.actorType, table.actorId), index("idx_audit_logs_target").on(table.targetType, table.targetId)]
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey(),
    routeKey: text("route_key").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    actorMemberId: uuid("actor_member_id").references(() => members.id),
    requestHash: text("request_hash").notNull(),
    responseHash: text("response_hash"),
    status: text("status").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt,
    updatedAt
  },
  (table) => [uniqueIndex("idempotency_keys_route_key").on(table.routeKey, table.idempotencyKey)]
);

export const providerWebhookEvents = pgTable(
  "provider_webhook_events",
  {
    id: uuid("id").primaryKey(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    signatureVerifiedAt: timestamp("signature_verified_at", { withTimezone: true }).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt
  },
  (table) => [uniqueIndex("provider_webhook_events_provider_event_key").on(table.provider, table.providerEventId)]
);

export const coreSchemaTables = [
  cities,
  members,
  verificationCases,
  groups,
  groupMemberships,
  groupInvites,
  inviteRelayEvents,
  groupReadinessSnapshots,
  groupAvailabilitySnapshots,
  groupProfiles,
  vouchBlurbs,
  mediaAssets,
  introductionSets,
  introductions,
  introductionDecisions,
  conversations,
  conversationGroups,
  conversationParticipants,
  messages,
  breakoutRequests,
  venues,
  planFastTrackProposals,
  plans,
  planGroups,
  planOptions,
  planVotes,
  planRsvps,
  trustedContactShares,
  attendanceConfirmations,
  debriefs,
  debriefInterests,
  debriefLearningConsents,
  recommendationFeatureSnapshots,
  mutualEdges,
  safetyReports,
  safetyActions,
  consensusBlockVotes,
  blocks,
  moderationCases,
  actionQueueItems,
  notificationPreferences,
  notificationIntents,
  domainEventOutbox,
  auditLogs,
  idempotencyKeys,
  providerWebhookEvents
].map((table) => getTableName(table));

export const p0SchemaTables = {
  cities: { columns: ["id", "slug", "name", "country_code", "timezone", "launch_status"] },
  members: { columns: ["id", "auth_subject", "email", "phone_e164", "first_name", "city_id", "status", "verification_status"] },
  verification_cases: { columns: ["id", "member_id", "provider", "provider_inquiry_id", "status", "risk_flags"] },
  groups: { columns: ["id", "city_id", "format", "status", "eligibility_status", "distribution_floor_version"] },
  group_memberships: { columns: ["id", "group_id", "member_id", "role", "status", "publish_approved_at"] },
  group_invites: { columns: ["id", "group_id", "inviter_member_id", "token_hash", "status", "expires_at"] },
  invite_relay_events: { columns: ["id", "invite_id", "group_id", "event_type", "source_channel", "occurred_at"] },
  group_readiness_snapshots: { columns: ["id", "group_id", "member_id", "readiness_status", "blockers", "next_action", "secondary_actions", "computed_at", "source_event_id"] },
  group_availability_snapshots: { columns: ["id", "group_id", "window_start", "window_end", "timezone", "source", "confirmed_by_member_ids", "computed_at", "source_event_id"] },
  group_profiles: { columns: ["id", "group_id", "shared_vibe", "member_cards", "moderation_status", "published_at"] },
  vouch_blurbs: { columns: ["id", "group_id", "author_member_id", "subject_member_id", "body", "subject_approved_at", "moderation_status", "hidden_at"] },
  media_assets: { columns: ["id", "owner_member_id", "owner_group_id", "purpose", "object_key", "retention_class"] },
  introduction_sets: { columns: ["id", "recipient_group_id", "city_id", "set_date", "baseline_size", "entitlement_extra_size"] },
  introductions: { columns: ["id", "set_id", "recipient_group_id", "kind", "target_group_id", "target_plan_id", "score"] },
  introduction_decisions: { columns: ["id", "introduction_id", "group_id", "member_id", "decision_type"] },
  conversations: { columns: ["id", "kind", "status", "source_introduction_id", "parent_conversation_id"] },
  conversation_groups: { columns: ["conversation_id", "group_id", "role", "joined_at", "left_at"] },
  conversation_participants: { columns: ["conversation_id", "member_id", "group_id", "can_write", "last_read_message_id"] },
  messages: { columns: ["id", "conversation_id", "sender_member_id", "sender_group_id", "client_nonce", "sequence_number"] },
  breakout_requests: { columns: ["id", "parent_conversation_id", "requester_member_id", "recipient_member_id", "requester_group_id", "recipient_group_id"] },
  venues: { columns: ["id", "city_id", "name", "address_line", "venue_type", "safety_status"] },
  plan_fast_track_proposals: { columns: ["id", "conversation_id", "created_by_member_id", "source_group_id", "proposal_state", "time_options", "venue_options", "accepted_plan_id"] },
  plans: { columns: ["id", "conversation_id", "city_id", "format", "status", "confirmation_rule"] },
  plan_groups: { columns: ["plan_id", "group_id", "role", "status"] },
  plan_options: { columns: ["id", "plan_id", "option_type", "venue_id", "starts_at", "ends_at"] },
  plan_votes: { columns: ["id", "plan_id", "option_id", "member_id", "group_id", "vote_value"] },
  plan_rsvps: { columns: ["id", "plan_id", "member_id", "group_id", "status", "responded_at"] },
  trusted_contact_shares: { columns: ["id", "plan_id", "member_id", "contact_label", "contact_channel_hash"] },
  attendance_confirmations: { columns: ["id", "plan_id", "member_id", "group_id", "status", "source"] },
  debriefs: { columns: ["id", "plan_id", "member_id", "group_id", "attendance_status", "safety_concern"] },
  debrief_interests: { columns: ["id", "debrief_id", "plan_id", "source_member_id", "target_member_id", "signal", "visibility_status"] },
  debrief_learning_consents: { columns: ["id", "debrief_id", "plan_id", "member_id", "group_id", "status", "granted_at", "declined_at", "revoked_at"] },
  recommendation_feature_snapshots: { columns: ["id", "consent_id", "debrief_id", "plan_id", "member_id", "group_id", "feature_payload", "active", "expires_at"] },
  mutual_edges: { columns: ["id", "plan_id", "member_a_id", "member_b_id", "edge_type", "revealed_at"] },
  safety_reports: { columns: ["id", "reporter_member_id", "reporter_group_id", "target_group_id", "surface", "category", "narrative"] },
  safety_actions: { columns: ["id", "report_id", "action_type", "target_group_id", "target_plan_id", "status"] },
  consensus_block_votes: { columns: ["id", "acting_group_id", "voter_member_id", "target_member_id", "target_group_id"] },
  blocks: { columns: ["id", "source_group_id", "source_member_id", "target_member_id", "target_group_id", "block_scope"] },
  moderation_cases: { columns: ["id", "source_type", "source_id", "severity", "status", "classifier_scores"] },
  action_queue_items: { columns: ["id", "member_id", "group_id", "source_event_id", "target_type", "target_id", "action_kind", "deadline_at", "status", "dismissible"] },
  notification_preferences: { columns: ["member_id", "enabled_categories", "quiet_hours_start", "quiet_hours_end", "lockscreen_privacy"] },
  notification_intents: { columns: ["id", "source_event_id", "member_id", "group_id", "category", "dedupe_key"] },
  domain_event_outbox: { columns: ["id", "aggregate_type", "aggregate_id", "event_name", "sequence_number", "payload"] },
  audit_logs: { columns: ["id", "actor_type", "actor_id", "action", "target_type", "metadata"] },
  idempotency_keys: { columns: ["id", "route_key", "idempotency_key", "actor_member_id", "request_hash", "status"] },
  provider_webhook_events: { columns: ["id", "provider", "provider_event_id", "signature_verified_at", "idempotency_key"] }
} as const;

export const schemaTableNames = Object.keys(p0SchemaTables);

export const schemaColumnMap = {
  introductionSets: ["id", "recipientGroupId", "cityId", "setDate", "format", "baselineSize", "entitlementExtraSize"],
  introductions: ["id", "setId", "recipientGroupId", "kind", "targetGroupId", "targetPlanId", "status", "rankPosition", "score"],
  inviteRelayEvents: ["id", "inviteId", "groupId", "eventType", "sourceChannel", "occurredAt"],
  conversationParticipants: ["conversationId", "memberId", "groupId", "canWrite", "lastReadMessageId"],
  planFastTrackProposals: ["id", "conversationId", "createdByMemberId", "sourceGroupId", "proposalState", "timeOptions", "venueOptions"],
  planGroups: ["planId", "groupId", "role", "status"],
  debriefs: ["id", "planId", "memberId", "groupId", "attendanceStatus", "safetyConcern"],
  debriefLearningConsents: ["id", "debriefId", "planId", "memberId", "groupId", "status"],
  recommendationFeatureSnapshots: ["id", "consentId", "debriefId", "planId", "memberId", "groupId", "featurePayload", "active"],
  actionQueueItems: ["id", "memberId", "groupId", "sourceEventId", "targetType", "targetId", "actionKind", "status"],
  notificationIntents: ["id", "sourceEventId", "memberId", "groupId", "category", "dedupeKey"]
} as const;

const forbiddenPersistenceColumns = [
  "government_id",
  "liveness",
  "raw_document",
  "raw_provider_document",
  "calendar_title",
  "calendar_attendees",
  "calendar_notes",
  "calendar_location",
  "compatibility_score",
  "reliability_score"
];

export function validateSchemaPrivacyBoundaries(tables: typeof p0SchemaTables): void {
  for (const [tableName, table] of Object.entries(tables)) {
    for (const columnName of table.columns) {
      if (forbiddenPersistenceColumns.includes(columnName)) {
        throw new Error(`Forbidden persistence column ${String(columnName)} on ${tableName}`);
      }
    }
  }
}
