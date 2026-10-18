import { z } from 'zod';
import { isoDateTimeSchema, tenantIdSchema } from './ids.js';

/**
 * Per-tenant redaction terms (TASK-Q, Gate B, PRD §10, ADR 0029, ADR 0035).
 *
 * The names on this list are matched in the redactor (`services/ai/src/llm/redaction.ts`)
 * before any model call: every hit becomes a stable `[NAME_n]` placeholder, and the
 * reverse mapping lives only in memory for one analysis of one tenant.
 *
 * The audit trail (migration 0019) writes `redaction_term.add` / `redaction_term.remove`
 * with `target_kind = 'redaction_term'`, so an auditor can prove which names the
 * tenant has asked to redact and when. Removal is by row id, never by term text, so a
 * rename leaves the trail intact.
 */

/** Minimum length of a redaction term. Matches the SQL CHECK constraint. */
export const REDACTION_TERM_MIN_LENGTH = 2;
/** Maximum length of a redaction term (sanity cap for the admin form). */
export const REDACTION_TERM_MAX_LENGTH = 80;

/**
 * Wire shape of an `ai_redaction_terms` row. `id` is the row id used as the
 * audit-log target_id, so the remove action is stable across a term rename.
 */
export const redactionTermSchema = z.object({
  id: z.string().uuid(),
  tenantId: tenantIdSchema,
  term: z.string().min(REDACTION_TERM_MIN_LENGTH).max(REDACTION_TERM_MAX_LENGTH),
  createdAt: isoDateTimeSchema,
});
export type RedactionTerm = z.infer<typeof redactionTermSchema>;

/**
 * Write shape posted by the add-term form. `tenantId` is taken from the session
 * server-side, but the schema keeps it so the data layer signature stays honest.
 * Whitespace is trimmed and the term is lower-cased before the SQL `INSERT`,
 * so the `(tenant_id, term)` unique constraint collapses accidental case variants.
 */
export const redactionTermWriteSchema = z.object({
  tenantId: tenantIdSchema,
  term: z.string().trim().min(REDACTION_TERM_MIN_LENGTH).max(REDACTION_TERM_MAX_LENGTH),
});
export type RedactionTermWrite = z.infer<typeof redactionTermWriteSchema>;

/**
 * Identifies one term row for removal. The id is the audit-log target so a
 * later rename does not orphan the trail.
 */
export const redactionTermRemoveSchema = z.object({
  tenantId: tenantIdSchema,
  termId: z.string().uuid(),
});
export type RedactionTermRemove = z.infer<typeof redactionTermRemoveSchema>;
