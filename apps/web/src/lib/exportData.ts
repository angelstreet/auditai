import type { ExportKind, ExportRequest, TenantId, UserId } from '@auditai/contracts';
import { exportKindSchema } from '@auditai/contracts';
import { withTenant } from './db';

/**
 * Export data layer (M15, FR-09, PRD §15, §25.4).
 *
 * The analyst asks for an export of one of six `ExportKind`s (each maps
 * to a tenant-scoped table). We write an `export_requests` row, run the
 * read query, update the row count + status, and return the row count.
 * The CSV is materialised on demand by `materialiseCsv` so this layer
 * never holds a blob in memory longer than the request that asked.
 */

interface ExportRequestRow {
  id: string;
  tenant_id: string;
  requested_by: string;
  kind: ExportKind;
  status: 'pending' | 'completed' | 'failed';
  row_count: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

const fromRow = (r: ExportRequestRow): ExportRequest => ({
  id: r.id,
  tenantId: r.tenant_id as TenantId,
  requestedBy: r.requested_by as UserId,
  kind: r.kind,
  status: r.status,
  rowCount: r.row_count,
  error: r.error,
  createdAt: r.created_at,
  completedAt: r.completed_at,
});

/**
 * Run the export: write the request, count the rows, set the status,
 * and return the CSV string.
 */
export const runExport = async (
  tenantId: TenantId,
  kind: ExportKind,
  actorUserId: UserId,
): Promise<{ request: ExportRequest; csv: string }> => {
  if (!exportKindSchema.options.includes(kind)) {
    throw new Error(`unknown export kind: ${kind}`);
  }
  return withTenant(tenantId, async (client) => {
    const insert = await client.query<ExportRequestRow>(
      `INSERT INTO export_requests (tenant_id, requested_by, kind, status, row_count)
       VALUES ($1, $2, $3, 'pending', 0)
       RETURNING id, tenant_id, requested_by, kind, status, row_count, error, created_at, completed_at`,
      [tenantId, actorUserId, kind],
    );
    const inserted = insert.rows[0];
    if (!inserted) throw new Error('export_requests insert did not return a row');
    try {
      const rows = await materialiseQuery(client, kind, tenantId);
      const csv = rowsToCsv(rows.columns, rows.values);
      const upd = await client.query<ExportRequestRow>(
        `UPDATE export_requests
            SET status = 'completed', row_count = $2, completed_at = now()
          WHERE id = $1
          RETURNING id, tenant_id, requested_by, kind, status, row_count, error, created_at, completed_at`,
        [inserted.id, rows.values.length],
      );
      const updated = upd.rows[0];
      if (!updated) throw new Error('export_requests update did not return a row');
      return { request: fromRow(updated), csv };
    } catch (err) {
      await client.query(`UPDATE export_requests SET status = 'failed', error = $2 WHERE id = $1`, [
        inserted.id,
        err instanceof Error ? err.message : String(err),
      ]);
      throw err;
    }
  });
};

export const listExportRequests = async (
  tenantId: TenantId,
): Promise<ReadonlyArray<ExportRequest>> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<ExportRequestRow>(
      `SELECT id, tenant_id, requested_by, kind, status, row_count, error, created_at, completed_at
         FROM export_requests
        WHERE tenant_id = $1
        ORDER BY created_at DESC`,
      [tenantId],
    );
    return rows.map(fromRow);
  });
};

/** Internal: run the read query that backs each export kind. */
const materialiseQuery = async (
  client: import('pg').PoolClient,
  kind: ExportKind,
  tenantId: TenantId,
): Promise<{ columns: string[]; values: unknown[][] }> => {
  switch (kind) {
    case 'opportunities': {
      const r = await client.query(
        `SELECT id, engagement_id, status, title, description, axis, impact_score, owner_user_id, created_by, created_at, updated_at, archived_at
           FROM opportunities
          WHERE tenant_id = $1
          ORDER BY created_at DESC`,
        [tenantId],
      );
      return { columns: r.fields.map((f) => f.name), values: r.rows.map(toRow) };
    }
    case 'analyses': {
      const r = await client.query(
        `SELECT id, engagement_id, submission_id, version, sensitivity, theme_count, prompt_count, model_route, approved_at, approved_by, created_at
           FROM analyses
          WHERE tenant_id = $1
          ORDER BY created_at DESC`,
        [tenantId],
      );
      return { columns: r.fields.map((f) => f.name), values: r.rows.map(toRow) };
    }
    case 'respondent_badges': {
      const r = await client.query(
        `SELECT id, respondent_pseudonym, engagement_id, quiz_score, mascot_tier, is_current, assigned_at, retention_at
           FROM respondent_badges
          WHERE tenant_id = $1
          ORDER BY assigned_at DESC`,
        [tenantId],
      );
      return { columns: r.fields.map((f) => f.name), values: r.rows.map(toRow) };
    }
    case 'team_badges': {
      const r = await client.query(
        `SELECT id, team_id, dominant_tier, member_count, tortoise_count, fox_count, owl_count, computed_at
           FROM team_badges
          WHERE tenant_id = $1
          ORDER BY computed_at DESC`,
        [tenantId],
      );
      return { columns: r.fields.map((f) => f.name), values: r.rows.map(toRow) };
    }
    case 'synergies': {
      const r = await client.query(
        `SELECT id, axis, theme_label, synergy_key, source_analysis_ids, source_engagement_ids, occurrence_count, status, detected_at
           FROM synergies
          WHERE tenant_id = $1
          ORDER BY detected_at DESC`,
        [tenantId],
      );
      return { columns: r.fields.map((f) => f.name), values: r.rows.map(toRow) };
    }
    case 'audit_log': {
      const r = await client.query(
        `SELECT id, actor_user_id, action, target_kind, target_id, payload_json, created_at
           FROM audit_log
          WHERE tenant_id = $1
          ORDER BY created_at DESC`,
        [tenantId],
      );
      return { columns: r.fields.map((f) => f.name), values: r.rows.map(toRow) };
    }
  }
};

const toRow = (r: Record<string, unknown>): unknown[] =>
  Object.values(r).map((v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (v instanceof Date) return v.toISOString();
    return JSON.stringify(v);
  });

const rowsToCsv = (columns: string[], values: unknown[][]): string => {
  const escape = (cell: unknown): string => {
    const s =
      typeof cell === 'string' ? cell : cell === null || cell === undefined ? '' : String(cell);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const header = columns.map(escape).join(',');
  const body = values.map((row) => row.map(escape).join(',')).join('\n');
  return body ? `${header}\n${body}\n` : `${header}\n`;
};
