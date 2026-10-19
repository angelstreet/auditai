import { createHash } from 'node:crypto';
import { withServiceAccount } from './db';

/**
 * Rate limit for public forms that must not reveal anything (TASK-U, ADR 0040): forgot-password and
 * the privacy request. Same idea as loginThrottle: SHA-256 keys, counted in Postgres, so it holds
 * across serverless instances. Every call is counted, whether or not the address exists, so the
 * limit cannot be used to tell accounts apart.
 */
export type PublicKind = 'forgot_password' | 'privacy_request';

export const PUBLIC_LIMITS: Record<
  PublicKind,
  { windowMinutes: number; perEmail: number; perIp: number }
> = {
  forgot_password: { windowMinutes: 60, perEmail: 3, perIp: 10 },
  privacy_request: { windowMinutes: 60, perEmail: 5, perIp: 10 },
};

const digest = (scope: 'email' | 'ip', value: string): string =>
  createHash('sha256').update(`${scope}:${value.trim().toLowerCase()}`).digest('hex');

export const isOverLimit = (kind: PublicKind, counts: { email: number; ip: number }): boolean =>
  counts.email > PUBLIC_LIMITS[kind].perEmail || counts.ip > PUBLIC_LIMITS[kind].perIp;

/**
 * Count this attempt and say whether it is over the limit. The attempt is recorded first, so a
 * burst cannot slip through between a check and a write.
 */
export const hitPublicLimit = async (
  kind: PublicKind,
  email: string,
  address: string,
): Promise<boolean> =>
  withServiceAccount(async (client) => {
    const { windowMinutes } = PUBLIC_LIMITS[kind];
    const e = digest('email', email);
    const i = digest('ip', address);
    await client.query(
      `INSERT INTO public_attempts (kind, scope, key_hash) VALUES ($1, 'email', $2), ($1, 'ip', $3)`,
      [kind, e, i],
    );
    const { rows } = await client.query<{ scope: 'email' | 'ip'; n: string }>(
      `SELECT scope, count(*)::text AS n FROM public_attempts
        WHERE kind = $1 AND attempted_at > now() - make_interval(mins => $4)
          AND ((scope = 'email' AND key_hash = $2) OR (scope = 'ip' AND key_hash = $3))
        GROUP BY scope`,
      [kind, e, i, windowMinutes],
    );
    const count = (s: 'email' | 'ip') => Number(rows.find((r) => r.scope === s)?.n ?? 0);
    await client.query(`DELETE FROM public_attempts WHERE attempted_at < now() - interval '1 day'`);
    return isOverLimit(kind, { email: count('email'), ip: count('ip') });
  });
