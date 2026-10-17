import { z } from 'zod';
import { isoDateTimeSchema, tenantIdSchema, userIdSchema } from './ids.js';

/**
 * Tenant-scoped export trail (M15, FR-09, PRD §15, §25.4).
 *
 * Every export request writes an `export_requests` row recording the
 * kind, the actor, the row count and the status. The analyst can
 * re-fetch the CSV from the row (no blob storage yet; the cell gets
 * `row_count` + a `completed_at` and the actual CSV is materialised
 * on demand).
 */

export const exportKindSchema = z.enum([
  'opportunities',
  'analyses',
  'respondent_badges',
  'team_badges',
  'synergies',
  'audit_log',
]);
export type ExportKind = z.infer<typeof exportKindSchema>;

export const exportStatusSchema = z.enum(['pending', 'completed', 'failed']);
export type ExportStatus = z.infer<typeof exportStatusSchema>;

export const exportRequestSchema = z.object({
  id: z.string().uuid(),
  tenantId: tenantIdSchema,
  requestedBy: userIdSchema,
  kind: exportKindSchema,
  status: exportStatusSchema,
  rowCount: z.number().int().min(0),
  error: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.nullable(),
});
export type ExportRequest = z.infer<typeof exportRequestSchema>;

export const exportRequestWriteSchema = z.object({
  tenantId: tenantIdSchema,
  requestedBy: userIdSchema,
  kind: exportKindSchema,
});
export type ExportRequestWrite = z.infer<typeof exportRequestWriteSchema>;
