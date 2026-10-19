import { withServiceAccount } from './db';

export type AuthAuditAction = 'password.set' | 'password.reset' | 'password.reset_request';

/**
 * Trail rows for the self-service password flows (TASK-U, ADR 0039). The actor and the target are
 * the person themselves; the row goes to every organisation they belong to, so each auditor sees
 * it. The payload never holds an address, a token or a password.
 */
export const auditSelf = async (
  userId: string,
  action: AuthAuditAction,
  payload: Record<string, unknown> = {},
): Promise<void> =>
  withServiceAccount(async (client) => {
    const { rows } = await client.query<{ tenant_id: string }>(
      `SELECT DISTINCT tenant_id FROM memberships WHERE user_id = $1`,
      [userId],
    );
    for (const { tenant_id } of rows) {
      await client.query(
        `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
         VALUES ($1, $2, $3, 'user', $2, $4)`,
        [tenant_id, userId, action, JSON.stringify(payload)],
      );
    }
  });
