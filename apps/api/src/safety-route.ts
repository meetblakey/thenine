import { buildSafetyBlock, buildSafetyReportIntake, buildUrgentSafetyAction } from "@thenine/domain";
import { DomainInvariantError } from "@thenine/domain/group-eligibility";
import type {
  SafetyBlockResult,
  SafetyBlockScope,
  SafetyReportCategory,
  SafetyReportIntakeResult,
  SafetyReportSurface,
  SafetySeverity,
  UrgentSafetyActionKind,
  UrgentSafetyActionResult
} from "@thenine/domain";
import { ApiRouteError } from "./launchpad-route.js";
import type { ApiErrorCode } from "./launchpad-route.js";

export const POST_SAFETY_REPORT_ROUTE = {
  method: "POST",
  path: "/v1/safety/reports",
  auth: "Member JWT",
  requiresIdempotencyKey: true
} as const;

export const POST_SAFETY_BLOCK_ROUTE = {
  method: "POST",
  path: "/v1/safety/blocks",
  auth: "Member JWT",
  requiresIdempotencyKey: true
} as const;

export const POST_SAFETY_URGENT_ACTION_ROUTE = {
  method: "POST",
  path: "/v1/safety/urgent-actions",
  auth: "Member JWT",
  requiresIdempotencyKey: true
} as const;

export interface SafetyMutationMember {
  memberId: string;
}

export interface SafetyMutationContext {
  member: SafetyMutationMember | null;
  idempotencyKey: string | null;
}

export interface SafetyReportClassification {
  caseId: string;
  severity: SafetySeverity;
  protectiveActions: string[];
}

export interface SafetyReportDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  assertEvidenceMediaApproved: (mediaAssetIds: string[], memberId: string) => Promise<void>;
  classifySafetyReport: (input: Record<string, unknown>) => Promise<SafetyReportClassification>;
  nextReportId: () => string;
  now: () => Date;
  persistSafetyReportIntake: (input: SafetyReportIntakeResult) => Promise<Record<string, unknown>>;
}

export interface SafetyBlockBody {
  sourceGroupId: string;
  targetMemberId?: string;
  targetGroupId?: string;
  blockScope: SafetyBlockScope;
  reasonCode?: string;
}

export interface SafetyBlockDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  assertGroupMemberAccess: (groupId: string, memberId: string) => Promise<void>;
  nextBlockId: () => string;
  now: () => Date;
  persistSafetyBlock: (input: SafetyBlockResult) => Promise<{ blockId: string; applied: true }>;
}

export interface UrgentSafetyActionBody {
  surface: string;
  groupId?: string;
  conversationId?: string;
  planId?: string;
  action: UrgentSafetyActionKind;
}

export interface UrgentSafetyActionDependencies {
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>;
  assertUrgentActionAccess: (input: { memberId: string; groupId?: string; conversationId?: string; planId?: string }) => Promise<void>;
  nextActionId: () => string;
  now: () => Date;
  persistUrgentSafetyAction: (input: UrgentSafetyActionResult) => Promise<{ actionId: string; status: "applied" | "queued"; guidance: string }>;
}

export async function handlePostSafetyReport(
  context: SafetyMutationContext,
  body: Record<string, unknown>,
  dependencies: SafetyReportDependencies
): Promise<Record<string, unknown>> {
  const member = requireSafetyMember(context.member);
  await reserveRequiredSafetyIdempotency(
    POST_SAFETY_REPORT_ROUTE.method,
    POST_SAFETY_REPORT_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );

  const evidenceMediaAssetIds = asStringArray(body.evidenceMediaAssetIds);

  if (evidenceMediaAssetIds.length > 0) {
    await dependencies.assertEvidenceMediaApproved(evidenceMediaAssetIds, member.memberId);
  }

  const classification = await dependencies.classifySafetyReport({
    ...body,
    reporterMemberId: member.memberId
  });
  const targetMemberId = asOptionalString(body.targetMemberId);
  const targetGroupId = asOptionalString(body.targetGroupId);
  const targetConversationId = asOptionalString(body.targetConversationId);
  const targetPlanId = asOptionalString(body.targetPlanId);
  const targetVenueId = asOptionalString(body.targetVenueId);
  const narrative = asOptionalString(body.narrative);

  try {
    const intake = buildSafetyReportIntake({
      reportId: dependencies.nextReportId(),
      caseId: classification.caseId,
      reporterMemberId: member.memberId,
      reporterGroupId: asNullableString(body.reporterGroupId),
      surface: requireString(body.surface, "surface") as SafetyReportSurface,
      category: requireString(body.category, "category") as SafetyReportCategory,
      severity: classification.severity,
      protectiveActions: classification.protectiveActions,
      ...(targetMemberId === undefined ? {} : { targetMemberId }),
      ...(targetGroupId === undefined ? {} : { targetGroupId }),
      ...(targetConversationId === undefined ? {} : { targetConversationId }),
      ...(targetPlanId === undefined ? {} : { targetPlanId }),
      ...(targetVenueId === undefined ? {} : { targetVenueId }),
      ...(narrative === undefined ? {} : { narrative }),
      evidenceMediaAssetIds,
      createdAt: dependencies.now().toISOString()
    });

    return await dependencies.persistSafetyReportIntake(intake);
  } catch (error) {
    throw mapSafetyDomainError(error);
  }
}

export async function handlePostSafetyBlock(
  context: SafetyMutationContext,
  body: SafetyBlockBody,
  dependencies: SafetyBlockDependencies
): Promise<{ blockId: string; applied: true }> {
  const member = requireSafetyMember(context.member);
  await reserveRequiredSafetyIdempotency(
    POST_SAFETY_BLOCK_ROUTE.method,
    POST_SAFETY_BLOCK_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );
  await dependencies.assertGroupMemberAccess(body.sourceGroupId, member.memberId);

  try {
    const block = buildSafetyBlock({
      blockId: dependencies.nextBlockId(),
      sourceGroupId: body.sourceGroupId,
      sourceMemberId: member.memberId,
      ...(body.targetMemberId === undefined ? {} : { targetMemberId: body.targetMemberId }),
      ...(body.targetGroupId === undefined ? {} : { targetGroupId: body.targetGroupId }),
      blockScope: body.blockScope,
      ...(body.reasonCode === undefined ? {} : { reasonCode: body.reasonCode }),
      createdAt: dependencies.now().toISOString()
    });

    return await dependencies.persistSafetyBlock(block);
  } catch (error) {
    throw mapSafetyDomainError(error);
  }
}

export async function handlePostSafetyUrgentAction(
  context: SafetyMutationContext,
  body: UrgentSafetyActionBody,
  dependencies: UrgentSafetyActionDependencies
): Promise<{ actionId: string; status: "applied" | "queued"; guidance: string }> {
  const member = requireSafetyMember(context.member);
  await reserveRequiredSafetyIdempotency(
    POST_SAFETY_URGENT_ACTION_ROUTE.method,
    POST_SAFETY_URGENT_ACTION_ROUTE.path,
    context,
    dependencies.reserveIdempotencyKey
  );
  await dependencies.assertUrgentActionAccess({
    memberId: member.memberId,
    ...(body.groupId === undefined ? {} : { groupId: body.groupId }),
    ...(body.conversationId === undefined ? {} : { conversationId: body.conversationId }),
    ...(body.planId === undefined ? {} : { planId: body.planId })
  });

  try {
    const urgentAction = buildUrgentSafetyAction({
      actionId: dependencies.nextActionId(),
      memberId: member.memberId,
      surface: body.surface,
      ...(body.groupId === undefined ? {} : { groupId: body.groupId }),
      ...(body.conversationId === undefined ? {} : { conversationId: body.conversationId }),
      ...(body.planId === undefined ? {} : { planId: body.planId }),
      action: body.action,
      createdAt: dependencies.now().toISOString()
    });

    return await dependencies.persistUrgentSafetyAction(urgentAction);
  } catch (error) {
    throw mapSafetyDomainError(error);
  }
}

function requireSafetyMember(member: SafetyMutationMember | null): SafetyMutationMember {
  if (member === null) {
    throw new ApiRouteError("UNAUTHENTICATED", "Safety routes require a member session.");
  }

  return member;
}

async function reserveRequiredSafetyIdempotency(
  method: string,
  path: string,
  context: SafetyMutationContext,
  reserveIdempotencyKey: (routeKey: string, idempotencyKey: string, actorMemberId: string) => Promise<void>
): Promise<void> {
  if (context.idempotencyKey === null || context.idempotencyKey.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", "Mutating routes require Idempotency-Key.");
  }

  const member = requireSafetyMember(context.member);
  await reserveIdempotencyKey(`${method} ${path}`, context.idempotencyKey, member.memberId);
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiRouteError("VALIDATION_ERROR", `Safety report requires ${fieldName}.`);
  }

  return value;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function asNullableString(value: unknown): string | null {
  return asOptionalString(value) ?? null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
}

function mapSafetyDomainError(error: unknown): Error {
  if (error instanceof DomainInvariantError) {
    return new ApiRouteError(error.code as ApiErrorCode, error.message);
  }

  return error instanceof Error ? error : new ApiRouteError("UNPROCESSABLE_STATE", "Unexpected Safety route failure.");
}
