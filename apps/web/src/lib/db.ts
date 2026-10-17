import pg from 'pg';
import { type TenantId, type InvitationId, type SubmissionId } from '@auditai/contracts';

/**
 * Postgres client used by the web app (M7).
 *
 * The connection pool is module-scoped so Next.js's hot reload does not leak connections. Every
 * query that touches tenant-scoped tables must run inside `withTenant` (or `withServiceAccount`)
 * so the corresponding `SET LOCAL app.tenant_id` (or `app.is_service_account`) is in effect for
 * the duration of the transaction. The pool runs as \`auditai_app\`; the bootstrap superuser is
 * only used by the migration runner.
 *
 * The lookup of the invitation record for a given token must itself be tenant-scoped. We issue the
 * SELECT under the appropriate tenant context once the caller has authenticated the invitation
 * via HMAC; if no row is returned we fall back to the service-account context so admin / debug
 * tooling can still find it.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEV_APP_PASSWORD = 'auditai';

/** Dev-only default; production must supply a real secret (fails closed). */
export const resolveAppPassword = (
  env: Record<string, string | undefined> = process.env,
): string => {
  const configured = env['DATABASE_APP_PASSWORD'];
  if (env['NODE_ENV'] === 'production' && (!configured || configured === DEV_APP_PASSWORD)) {
    throw new Error(
      'DATABASE_APP_PASSWORD must be set to a non-default value when NODE_ENV=production.',
    );
  }
  return configured ?? DEV_APP_PASSWORD;
};

let poolInstance: pg.Pool | null = null;

const buildPoolConfig = (): pg.PoolConfig => {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. The web app needs a Postgres instance; run `pnpm local:up` or set the env var in your deployment.',
    );
  }
  // The migration runner creates `auditai_app` (NOSUPERUSER, NOBYPASSRLS) so every query is
  // subject to RLS. Override here for tests that need to run as the bootstrap user.
  const user = process.env['DATABASE_APP_USER'] ?? 'auditai_app';
  return {
    connectionString: url,
    user,
    password: resolveAppPassword(),
    max: 10,
    idleTimeoutMillis: 10_000,
    application_name: 'auditai-web',
  };
};

export const getPool = (): pg.Pool => {
  if (!poolInstance) {
    poolInstance = new pg.Pool(buildPoolConfig());
  }
  return poolInstance;
};

/** Test helper: close the pool. Not used in production code paths. */
export const _closePool = async (): Promise<void> => {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
};

/**
 * Run a function in a transaction with `app.tenant_id` set to the given value. Mirrors the helper
 * in `tests/db/src/db.ts` so the same denial semantics apply at the API layer.
 */
export const withTenant = async <T>(
  tenantId: TenantId,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> => {
  if (!UUID_RE.test(tenantId)) throw new Error('withTenant: tenantId is not a UUID');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Same as \`withTenant\` but flags the transaction as a service-account operation. Used by admin
 * endpoints that legitimately need to read across tenants (e.g. listing all engagements owned
 * by the consultancy). The matching RLS policy from migration 0002 honours the flag.
 */
export const withServiceAccount = async <T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.is_service_account', 'on', true)`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Resolve the tenant id for a given invitation reference. RLS would normally hide rows from
 * other tenants, so this runs as a service account. Returns null when the invitation does not
 * exist (or the token reference is wrong).
 */
export const findTenantForInvitation = async (
  reference: string,
): Promise<{ tenantId: TenantId; invitationId: InvitationId; pseudonym: string } | null> => {
  return withServiceAccount(async (client) => {
    const { rows } = await client.query<{
      tenant_id: string;
      id: string;
      respondent_pseudonym: string;
    }>(
      `SELECT tenant_id, id, respondent_pseudonym
         FROM invitations
         WHERE token_reference = $1
         LIMIT 1`,
      [reference],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      tenantId: row.tenant_id as TenantId,
      invitationId: row.id as InvitationId,
      pseudonym: row.respondent_pseudonym,
    };
  });
};

/** Quick liveness probe used by the local-runner smoke test. */
export const pingDatabase = async (): Promise<boolean> => {
  const client = await getPool().connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
};

/** Re-export types for callers that want pg types without a second import. */
export type { SubmissionId };
