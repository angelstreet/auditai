import { z } from 'zod';
import { isoDateTimeSchema, tenantIdSchema, userIdSchema } from './ids.js';

/**
 * Tenant-scoped deletion trail (M15, FR-09, PRD §15, §25.4).
 *
 * Every deletion \u2014 whether right-to-erasure on a pseudonym,
 * retention-driven purge, or a per-engagement wipe \u2014 writes one
 * row. The trail is append-only (UPDATE / DELETE blocked by RLS)
 * so the auditor can reconstruct what was removed and when.
 */

export const deletionScopeSchema = z.enum([
  'respondent_pseudonym',
  'retention_expired',
  'engagement',
  'tenant',
]);
export type DeletionScope = z.infer<typeof deletionScopeSchema>;

export const deletionTargetKindSchema = z.enum([
  'respondent_badge',
  'synergy',
  'opportunity',
  'analysis',
  'audit_log',
  'export_request',
  'invitation',
  'respondent',
  'submission',
  'answer',
]);
export type DeletionTargetKind = z.infer<typeof deletionTargetKindSchema>;

export const deletionEventSchema = z.object({
  id: z.string().uuid(),
  tenantId: tenantIdSchema,
  requestedBy: userIdSchema,
  scope: deletionScopeSchema,
  /** Raw pseudonym on legacy rows; sha256(tenantId:pseudonym) hex on rows written by ADR 0030. */
  respondentPseudonym: z.string().min(8).max(64).nullable(),
  targetKind: deletionTargetKindSchema,
  targetId: z.string().uuid().nullable(),
  auditLogId: z.string().uuid().nullable(),
  /** Rows of this kind removed by the erase (one event per kind). */
  rowCount: z.number().int().nonnegative().default(1),
  createdAt: isoDateTimeSchema,
});
export type DeletionEvent = z.infer<typeof deletionEventSchema>;

/** Human input shape for the right-to-erasure admin action. */
export const deletionRequestSchema = z.object({
  tenantId: tenantIdSchema,
  requestedBy: userIdSchema,
  scope: z.literal('respondent_pseudonym'),
  respondentPseudonym: z.string().min(8).max(64),
});
export type DeletionRequest = z.infer<typeof deletionRequestSchema>;
