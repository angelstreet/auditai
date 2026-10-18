import { createHash } from 'node:crypto';
import { withServiceAccount } from './db';

/**
 * Rate limit and lockout for /api/auth/login (TASK-K, ADR 0032). State lives in Postgres
 * (`login_attempts`, migration 0017), so it holds across serverless instances without new
 * infrastructure. Keys are SHA-256 digests; the raw e-mail and address are never stored.
 *
 * Failures are counted per e-mail and per client address inside a sliding window. The e-mail
 * limit applies to any string, existing account or not, so a lockout reveals nothing about which
 * accounts exist.
 */
export const THROTTLE = {
  windowMinutes: 15,
  maxFailuresPerEmail: 5,
  maxFailuresPerIp: 20,
} as const;

export type Scope = 'email' | 'ip';

const digest = (scope: Scope, value: string): string =>
  createHash('sha256').update(`${scope}:${value.trim().toLowerCase()}`).digest('hex');

/** Pure policy: is a sign-in attempt allowed given the recent failure counts? */
export const isLockedOut = (failures: { email: number; ip: number }): boolean =>
  failures.email >= THROTTLE.maxFailuresPerEmail || failures.ip >= THROTTLE.maxFailuresPerIp;

/** Client address as set by the platform proxy; 'unknown' when absent (shared bucket). */
export const clientAddress = (headers: { get(name: string): string | null }): string => {
  const raw = headers.get('x-vercel-forwarded-for') ?? headers.get('x-forwarded-for') ?? '';
  return raw.split(',')[0]?.trim() || 'unknown';
};

export const recentFailures = async (
  email: string,
  address: string,
): Promise<{ email: number; ip: number }> =>
  withServiceAccount(async (client) => {
    const { rows } = await client.query<{ scope: Scope; n: string }>(
      `SELECT scope, count(*)::text AS n
         FROM login_attempts
        WHERE NOT succeeded
          AND attempted_at > now() - make_interval(mins => $3)
          AND ((scope = 'email' AND key_hash = $1) OR (scope = 'ip' AND key_hash = $2))
        GROUP BY scope`,
      [digest('email', email), digest('ip', address), THROTTLE.windowMinutes],
    );
    const count = (scope: Scope) => Number(rows.find((r) => r.scope === scope)?.n ?? 0);
    return { email: count('email'), ip: count('ip') };
  });

export const recordAttempt = async (
  email: string,
  address: string,
  succeeded: boolean,
): Promise<void> =>
  withServiceAccount(async (client) => {
    await client.query(
      `INSERT INTO login_attempts (scope, key_hash, succeeded)
       VALUES ('email', $1, $3), ('ip', $2, $3)`,
      [digest('email', email), digest('ip', address), succeeded],
    );
    if (succeeded) {
      // A good sign-in clears that e-mail's failures so the owner is never locked out by typos.
      await client.query(`DELETE FROM login_attempts WHERE scope = 'email' AND key_hash = $1`, [
        digest('email', email),
      ]);
    }
    // Housekeeping: nothing older than a day matters to the window.
    await client.query(`DELETE FROM login_attempts WHERE attempted_at < now() - interval '1 day'`);
  });
