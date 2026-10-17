import { z } from 'zod';
import {
  auditLogIdSchema,
  engagementIdSchema,
  isoDateTimeSchema,
  opportunityIdSchema,
  analysisIdSchema,
  tenantIdSchema,
  userIdSchema,
} from './ids.js';
import { synergyIdSchema } from './synergy.js';
// (All ids above are used by the discriminated variants below.)

/**
 * Audit log entry (M10, PRD §25.4).
 *
 * Every action an auditor takes on an analysis or an opportunity is appended here. The trail is
 * append-only: updates and deletes are blocked by RLS so a row in this table is the canonical
 * record of who did what and when.
 *
 * The `action` enum is also a CHECK constraint in the database; the schema mirrors it so a Zod
 * parse catches the typo before the SQL goes out.
 */
export const auditActionSchema = z.enum([
  'analysis.approve',
  'analysis.reject',
  'opportunity.create',
  'opportunity.update',
  'opportunity.archive',
  'synergy.detect',
  'synergy.surface',
  'synergy.dismiss',
  'synergy.archive',
  'export.complete',
  'badge.erase',
]);
export type AuditAction = z.infer<typeof auditActionSchema>;

export const auditTargetKindSchema = z.enum([
  'analysis',
  'opportunity',
  'synergy',
  'respondent_badge',
  'export_request',
]);
export type AuditTargetKind = z.infer<typeof auditTargetKindSchema>;

/**
 * `auditLogSchema` is the wire shape. `analysisId` / `opportunityId` are mutually exclusive and
 * discriminated by `targetKind`.
 */
export const auditLogSchema = z.object({
  id: auditLogIdSchema,
  tenantId: tenantIdSchema,
  actorUserId: userIdSchema,
  action: auditActionSchema,
  targetKind: auditTargetKindSchema,
  // The target row id. We do not brand it as AnalysisId / OpportunityId because the column is
  // polymorphic; the consumer must look at `targetKind` to know which one it is.
  targetId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()).default({}),
  createdAt: isoDateTimeSchema,
});
export type AuditLog = z.infer<typeof auditLogSchema>;

/**
 * Convenience constructor: the discriminated shape for an analysis-targeted action.
 */
export const analysisAuditLogSchema = auditLogSchema.extend({
  targetKind: z.literal('analysis'),
  targetId: analysisIdSchema,
});
export type AnalysisAuditLog = z.infer<typeof analysisAuditLogSchema>;

export const opportunityAuditLogSchema = auditLogSchema.extend({
  targetKind: z.literal('opportunity'),
  targetId: opportunityIdSchema,
});
export type OpportunityAuditLog = z.infer<typeof opportunityAuditLogSchema>;

/**
 * Convenience constructor: the discriminated shape for a synergy-targeted action.
 */
export const synergyAuditLogSchema = auditLogSchema.extend({
  targetKind: z.literal('synergy'),
  targetId: synergyIdSchema,
});
export type SynergyAuditLog = z.infer<typeof synergyAuditLogSchema>;

/**
 * The shape of an audit-log write request (no id, no createdAt). The server fills those in.
 */
export const auditLogWriteSchema = z
  .object({
    actorUserId: userIdSchema,
    action: auditActionSchema,
    targetKind: auditTargetKindSchema,
    targetId: z.string().uuid(),
    payload: z.record(z.string(), z.unknown()).default({}),
    engagementId: engagementIdSchema.optional(),
  })
  .refine(
    (v) =>
      (v.targetKind === 'analysis' && v.payload !== undefined) || v.targetKind === 'opportunity',
    { message: 'analysis actions must include a payload' },
  );
export type AuditLogWrite = z.infer<typeof auditLogWriteSchema>;

/**
 * The shape returned by the auditor approval action (M10). Mirrors the row written to
 * `analyses` + the new `audit_log` row.
 */
export const approvalResultSchema = z.object({
  analysisId: analysisIdSchema,
  approvedAt: isoDateTimeSchema,
  approvedBy: userIdSchema,
  auditLogId: auditLogIdSchema,
});
export type ApprovalResult = z.infer<typeof approvalResultSchema>;
