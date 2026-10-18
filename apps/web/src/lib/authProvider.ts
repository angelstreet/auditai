import { createHash } from 'node:crypto';
import { withServiceAccount } from './db';
import { verifyPassword } from './password';
import type { SessionTenant } from './session';

/**
 * Pluggable authentication (ADR 0023). A provider turns credentials into an authenticated user
 * id; memberships are always loaded from the database afterwards, so a future SSO / MFA provider
 * (Gate C) only has to implement `authenticate`.
 */
export interface AuthenticatedUser {
  readonly id: string;
  readonly name: string;
}

export interface AuthProvider {
  readonly name: string;
  authenticate(credentials: Record<string, string>): Promise<AuthenticatedUser | null>;
}

export const emailHash = (email: string): string =>
  createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

// Verified against a throwaway hash when the user is unknown, to keep timing similar.
const DUMMY_HASH =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

export const passwordProvider: AuthProvider = {
  name: 'password',
  async authenticate(credentials) {
    const email = credentials['email'] ?? '';
    const password = credentials['password'] ?? '';
    if (!email || !password || password.length > 256) return null;
    const row = await withServiceAccount(async (client) => {
      const { rows } = await client.query<{
        id: string;
        display_name: string;
        password_hash: string | null;
        disabled_at: string | null;
      }>(
        `SELECT id, display_name, password_hash, disabled_at FROM users WHERE email_hash = $1 LIMIT 1`,
        [emailHash(email)],
      );
      return rows[0] ?? null;
    });
    const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !row.password_hash || row.disabled_at || !ok) return null;
    return { id: row.id, name: row.display_name };
  },
};

export const activeProvider: AuthProvider = passwordProvider;

/**
 * Current memberships of a user: tenant-level rows, plus team-scoped client rows (team_referent)
 * with their team, which the /client surface needs (TASK-P, ADR 0035).
 */
export const loadMemberships = async (userId: string): Promise<SessionTenant[]> =>
  withServiceAccount(async (client) => {
    const { rows } = await client.query<{
      tenant_id: string;
      role: string;
      team_id: string | null;
    }>(
      `SELECT tenant_id, role, team_id FROM memberships
        WHERE user_id = $1
          AND (team_id IS NULL OR role = 'team_referent')
          AND (starts_at IS NULL OR starts_at <= now())
          AND (ends_at IS NULL OR ends_at > now())
        ORDER BY tenant_id, role, team_id`,
      [userId],
    );
    return rows.map((r) =>
      r.team_id ? { id: r.tenant_id, role: r.role, teamId: r.team_id } : { id: r.tenant_id, role: r.role },
    );
  });
