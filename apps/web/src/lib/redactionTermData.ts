import type { RedactionTerm, TenantId, UserId } from '@evolai/contracts';
import { redactionTermWriteSchema, redactionTermRemoveSchema } from '@evolai/contracts';
import { withTenant } from './db';

/**
 * Redaction terms data layer (TASK-Q, Gate B, PRD §10, ADR 0029, ADR 0035).
 *
 * `listRedactionTerms` returns every row the tenant has on file, oldest first.
 * `addRedactionTerm` is idempotent on `(tenant_id, term)` — the unique constraint
 * collapses accidental duplicates; we re-read the row so the wire shape is the same
 * whether the row was just inserted or already existed. `removeRedactionTerm` deletes
 * by row id and writes the matching `audit_log` row.
 *
 * Every mutating call writes one `audit_log` row with `target_kind = 'redaction_term'`
 * and the row id as `target_id`. The trail records who added or removed which term
 * and when, so the redaction list is reviewable end-to-end.
 */

interface RedactionTermRow {
  id: string;
  tenant_id: string;
  term: string;
  created_at: string;
}

const fromRow = (r: RedactionTermRow): RedactionTerm => ({
  id: r.id,
  tenantId: r.tenant_id as TenantId,
  term: r.term,
  createdAt: r.created_at,
});

export const listRedactionTerms = async (
  tenantId: TenantId,
): Promise<ReadonlyArray<RedactionTerm>> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RedactionTermRow>(
      `SELECT id, tenant_id, term, created_at
         FROM ai_redaction_terms
        WHERE tenant_id = $1
        ORDER BY created_at ASC, term ASC`,
      [tenantId],
    );
    return rows.map(fromRow);
  });

/** Insert one term for the tenant. Idempotent on `(tenant_id, term)`. */
export const addRedactionTerm = async (
  tenantId: TenantId,
  rawTerm: string,
  actorUserId: UserId,
): Promise<RedactionTerm> => {
  const write = redactionTermWriteSchema.parse({ tenantId, term: rawTerm });
  // The (tenant_id, term) uniq index normalises case via the column collation; we still
  // trim and lower-case in the schema so the wire shape matches the stored row exactly.
  const normalised = write.term.toLowerCase();
  return withTenant(tenantId, async (client) => {
    const ins = await client.query<RedactionTermRow>(
      `INSERT INTO ai_redaction_terms (tenant_id, term)
            VALUES ($1, $2)
       ON CONFLICT (tenant_id, term) DO UPDATE SET term = EXCLUDED.term
       RETURNING id, tenant_id, term, created_at`,
      [tenantId, normalised],
    );
    const row = ins.rows[0];
    if (!row) throw new Error('ai_redaction_terms upsert did not return a row');
    await client.query(
      `INSERT INTO audit_log (
          tenant_id, actor_user_id, action, target_kind, target_id, payload_json
        ) VALUES ($1, $2, 'redaction_term.add', 'redaction_term', $3, $4::jsonb)`,
      [tenantId, actorUserId, row.id, JSON.stringify({ term: row.term })],
    );
    return fromRow(row);
  });
};

/** Delete one term by row id. Returns true when a row was removed, false when it was already gone. */
export const removeRedactionTerm = async (
  tenantId: TenantId,
  rawTermId: string,
  actorUserId: UserId,
): Promise<{ removed: boolean; term: string }> => {
  const remove = redactionTermRemoveSchema.parse({ tenantId, termId: rawTermId });
  return withTenant(tenantId, async (client) => {
    const read = await client.query<{ term: string }>(
      `SELECT term FROM ai_redaction_terms WHERE tenant_id = $1 AND id = $2`,
      [tenantId, remove.termId],
    );
    const existing = read.rows[0];
    if (!existing) return { removed: false, term: '' };
    await client.query(`DELETE FROM ai_redaction_terms WHERE tenant_id = $1 AND id = $2`, [
      tenantId,
      remove.termId,
    ]);
    await client.query(
      `INSERT INTO audit_log (
          tenant_id, actor_user_id, action, target_kind, target_id, payload_json
        ) VALUES ($1, $2, 'redaction_term.remove', 'redaction_term', $3, $4::jsonb)`,
      [tenantId, actorUserId, remove.termId, JSON.stringify({ term: existing.term })],
    );
    return { removed: true, term: existing.term };
  });
};
