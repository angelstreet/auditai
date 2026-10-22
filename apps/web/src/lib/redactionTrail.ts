import type { TenantId } from '@evolai/contracts';
import { withServiceAccount } from './db';

/**
 * Reads the most recent redaction_term.add / redaction_term.remove audit rows for the
 * tenant. The trail is purely informational here: the data layer already wrote it as part
 * of the add / remove path.
 */
export const readRedactionTrail = async (
  tenantId: TenantId,
): Promise<
  ReadonlyArray<{
    id: string;
    action: 'redaction_term.add' | 'redaction_term.remove';
    actorName: string;
    term: string;
    createdAt: string;
  }>
> =>
  withServiceAccount(async (client) => {
    // The audit log is tenant-scoped via RLS; a service account reads across tenants but we
    // filter explicitly so the row count matches what the page would render.
    const { rows } = await client.query<{
      id: string;
      action: string;
      actor_name: string | null;
      payload_json: { term?: string };
      created_at: string;
    }>(
      `SELECT al.id, al.action, u.display_name AS actor_name, al.payload_json, al.created_at
         FROM audit_log al
         LEFT JOIN users u ON u.id = al.actor_user_id
        WHERE al.tenant_id = $1
          AND al.target_kind = 'redaction_term'
        ORDER BY al.created_at DESC
        LIMIT 50`,
      [tenantId],
    );
    return rows.map((r) => ({
      id: r.id,
      action: r.action as 'redaction_term.add' | 'redaction_term.remove',
      actorName: r.actor_name ?? '—',
      term: r.payload_json.term ?? '',
      createdAt: r.created_at,
    }));
  });
