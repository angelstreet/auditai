import { createHash, timingSafeEqual } from 'node:crypto';
import { withServiceAccount } from './db';

/**
 * Scheduled retention pass for the Vercel cron (TASK-K, ADR 0032). Same rule and SQL function as
 * services/ai/src/retentionWorker.ts (ADR 0030): a pseudonym is erased when every badge it holds is
 * past `retention_at`, one transaction per tenant, actor = the system user.
 */
const SYSTEM_ACTOR = '00000000-0000-4000-8000-000000000000';

/** Constant-time bearer check. Fails closed when CRON_SECRET is unset or too short. */
export const isCronAuthorized = (
  authorization: string | null,
  secret: string | undefined = process.env['CRON_SECRET'],
): boolean => {
  if (!secret || secret.length < 16 || !authorization) return false;
  const digest = (v: string) => createHash('sha256').update(v).digest();
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
};

export const runRetentionPass = async (): Promise<{ tenantsScanned: number; purged: number }> => {
  const tenants = await withServiceAccount(async (client) => {
    const { rows } = await client.query<{ id: string }>('SELECT id FROM tenants');
    return rows.map((r) => r.id);
  });
  let purged = 0;
  for (const tenantId of tenants) {
    purged += await withServiceAccount(async (client) => {
      const due = await client.query<{ respondent_pseudonym: string }>(
        `SELECT respondent_pseudonym
           FROM respondent_badges
          WHERE tenant_id = $1
          GROUP BY respondent_pseudonym
         HAVING bool_and(retention_at IS NOT NULL AND retention_at <= now())`,
        [tenantId],
      );
      for (const d of due.rows) {
        await client.query(`SELECT erase_respondent_pseudonym($1, $2, $3, 'retention_expired')`, [
          tenantId,
          d.respondent_pseudonym,
          SYSTEM_ACTOR,
        ]);
      }
      return due.rows.length;
    });
  }
  return { tenantsScanned: tenants.length, purged };
};
