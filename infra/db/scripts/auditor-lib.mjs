/**
 * Auditor account management (TASK-K, ADR 0032). Pure functions over a connected pg client so the
 * CLI (auditor.mjs) and the tests share one code path. Password hashing matches
 * apps/web/src/lib/password.ts byte for byte (`scrypt$N$r$p$salt$hash`).
 */
import { createHash, randomBytes, randomUUID, scrypt } from 'node:crypto';

export const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 256;
/** Actor recorded in audit_log for CLI changes: the system user seeded by migration 0014. */
export const CLI_ACTOR_ID = '00000000-0000-4000-8000-000000000000';
const SCRYPT = { N: 16384, r: 8, p: 1 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normaliseEmail = (email) => email.trim().toLowerCase();

export const emailHash = (email) =>
  createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

export const hashPassword = (password) =>
  new Promise((resolve, reject) => {
    const salt = randomBytes(16);
    scrypt(password, salt, 32, SCRYPT, (err, key) =>
      err
        ? reject(err)
        : resolve(
            `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`,
          ),
    );
  });

/** Throws on a weak password. Never echoes the password. */
export const assertStrongPassword = (password) => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`password must be at most ${MAX_PASSWORD_LENGTH} characters`);
  }
  if (new Set(password).size < 5) throw new Error('password is too repetitive');
};

const host = (url) => new URL(url).hostname.toLowerCase();
/** Neon's pooled host is the direct host with `-pooler` appended to the endpoint label. */
const canonicalHost = (h) => h.replace(/-pooler(?=\.|$)/, '');

/**
 * The connection string the CLI uses: DATABASE_URL_UNPOOLED when set, else DATABASE_URL. When both
 * are set they must point at the same database host (pooled and direct endpoints of one Neon
 * database compare equal), so a stale shell variable cannot send a change elsewhere.
 * `expectedHost` (--expect-host) pins the target explicitly.
 */
export const resolveTargetUrl = (env, expectedHost) => {
  const direct = env['DATABASE_URL_UNPOOLED'];
  const main = env['DATABASE_URL'];
  const url = direct ?? main;
  if (!url) throw new Error('DATABASE_URL (or DATABASE_URL_UNPOOLED) is not set');
  if (direct && main && canonicalHost(host(direct)) !== canonicalHost(host(main))) {
    throw new Error('DATABASE_URL and DATABASE_URL_UNPOOLED point at different hosts; refusing');
  }
  if (expectedHost && canonicalHost(host(url)) !== canonicalHost(expectedHost.toLowerCase())) {
    throw new Error('database host does not match --expect-host; refusing');
  }
  return url;
};

export const inServiceTx = async (client, fn) => {
  await client.query('BEGIN');
  try {
    await client.query(`SELECT set_config('app.is_service_account', 'on', true)`);
    const out = await fn();
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  }
};

export const audit = (client, tenantId, action, userId, payload) =>
  client.query(
    `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
     VALUES ($1, $2, $3, 'user', $4, $5)`,
    [tenantId, CLI_ACTOR_ID, action, userId, JSON.stringify({ via: 'cli', ...payload })],
  );

const requireUser = async (client, email) => {
  const { rows } = await client.query('SELECT id FROM users WHERE email_hash = $1', [
    emailHash(email),
  ]);
  if (!rows[0]) throw new Error('no such user');
  const m = await client.query(
    `SELECT DISTINCT tenant_id FROM memberships WHERE user_id = $1 ORDER BY tenant_id`,
    [rows[0].id],
  );
  return { id: rows[0].id, tenants: m.rows.map((r) => r.tenant_id) };
};

export const createAuditor = async (client, { email, tenantIds, password }) => {
  if (!EMAIL_RE.test(email ?? '')) throw new Error('a valid --email is required');
  if (!tenantIds?.length || !tenantIds.every((t) => UUID_RE.test(t))) {
    throw new Error('at least one --tenant <uuid> is required');
  }
  assertStrongPassword(password);
  return hashPassword(password).then((hash) =>
    inServiceTx(client, async () => {
      const found = await client.query(
        'SELECT count(*)::int AS n FROM tenants WHERE id = ANY($1)',
        [tenantIds],
      );
      if (found.rows[0].n !== tenantIds.length) throw new Error('unknown tenant id');
      const id = randomUUID();
      const ins = await client.query(
        `INSERT INTO users (id, email_hash, email, password_hash) VALUES ($1, $2, $3, $4)
         ON CONFLICT (email_hash) DO NOTHING RETURNING id`,
        [id, emailHash(email), normaliseEmail(email), hash],
      );
      if (!ins.rows[0]) throw new Error('a user with this e-mail already exists');
      for (const tenantId of tenantIds) {
        await client.query(
          `INSERT INTO memberships (id, tenant_id, user_id, role) VALUES ($1, $2, $3, 'auditor')`,
          [randomUUID(), tenantId, id],
        );
        await audit(client, tenantId, 'user.create', id, { role: 'auditor' });
      }
      return { id };
    }),
  );
};

export const setAuditorPassword = async (client, { email, password }) => {
  assertStrongPassword(password);
  return hashPassword(password).then((hash) =>
    inServiceTx(client, async () => {
      const user = await requireUser(client, email);
      await client.query('UPDATE users SET password_hash = $2, disabled_at = NULL WHERE id = $1', [
        user.id,
        hash,
      ]);
      for (const t of user.tenants) await audit(client, t, 'user.set_password', user.id, {});
      return { id: user.id };
    }),
  );
};

export const disableAuditor = async (client, { email }) =>
  inServiceTx(client, async () => {
    const user = await requireUser(client, email);
    await client.query('UPDATE users SET password_hash = NULL, disabled_at = now() WHERE id = $1', [
      user.id,
    ]);
    for (const t of user.tenants) await audit(client, t, 'user.disable', user.id, {});
    return { id: user.id };
  });

/**
 * Replace a user's sign-in e-mail (TASK-P): e.g. a referent persona seeded with a placeholder
 * `.invalid` address gets the real one. Only the hash is stored; the trail records neither address.
 */
export const setUserEmail = async (client, { email, newEmail }) => {
  if (!EMAIL_RE.test(newEmail ?? '')) throw new Error('a valid --new-email is required');
  return inServiceTx(client, async () => {
    const user = await requireUser(client, email);
    const clash = await client.query('SELECT 1 FROM users WHERE email_hash = $1 AND id <> $2', [
      emailHash(newEmail),
      user.id,
    ]);
    if (clash.rows[0]) throw new Error('a user with this e-mail already exists');
    await client.query('UPDATE users SET email_hash = $2, email = $3 WHERE id = $1', [
      user.id,
      emailHash(newEmail),
      normaliseEmail(newEmail),
    ]);
    for (const t of user.tenants) await audit(client, t, 'user.set_email', user.id, {});
    return { id: user.id };
  });
};
