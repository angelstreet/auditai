/**
 * Strip personal names from existing accounts (TASK-X, ADR 0044). Idempotent. Returns counts only:
 * it never returns or prints a name or an address.
 *
 *   1. Placeholder referent accounts (no password, address = slug(display name)@<tenant>.invalid,
 *      as the first seed script wrote them) get a generic address referent-<n>@<tenant>.invalid,
 *      so no name remains in any address. Same effect as `auditor:set-email`, one audit row each.
 *   2. users.display_name is set to null for every user.
 */
import { CLI_ACTOR_ID, audit, emailHash, inServiceTx } from './auditor-lib.mjs';
import { slugify } from './client-seed-lib.mjs';

const GENERIC_RE = /^referent-\d+@/;

class DryRun extends Error {
  constructor(result) {
    super('dry run');
    this.result = result;
  }
}

/** Dry run: the work runs in the transaction, which is then rolled back. */
export const stripIdentities = async (client, { apply = false } = {}) => {
  try {
    return await strip(client, apply);
  } catch (err) {
    if (err instanceof DryRun) return err.result;
    throw err;
  }
};

const strip = (client, apply) =>
  inServiceTx(client, async () => {
    const { rows: refs } = await client.query(
      `SELECT DISTINCT u.id, u.email_hash, u.email, u.display_name, t.slug
         FROM users u
         JOIN memberships m ON m.user_id = u.id AND m.role = 'team_referent'
         JOIN tenants t ON t.id = m.tenant_id
        WHERE u.password_hash IS NULL
        ORDER BY u.id`,
    );
    let rewritten = 0;
    for (const u of refs) {
      const known = u.email ? u.email.toLowerCase() : null;
      const legacy = u.display_name
        ? `${slugify(u.display_name) || 'referent'}@${u.slug}.invalid`
        : null;
      const isPlaceholder =
        (known !== null && known.endsWith('.invalid') && !GENERIC_RE.test(known)) ||
        (legacy !== null && emailHash(legacy) === u.email_hash);
      if (!isPlaceholder) continue;
      let n = 1;
      let next;
      for (;;) {
        next = `referent-${n}@${u.slug}.invalid`;
        const clash = await client.query('SELECT 1 FROM users WHERE email_hash = $1 AND id <> $2', [
          emailHash(next),
          u.id,
        ]);
        if (clash.rowCount === 0) break;
        n += 1;
      }
      await client.query('UPDATE users SET email_hash = $2, email = $3 WHERE id = $1', [
        u.id,
        emailHash(next),
        next,
      ]);
      const tenants = await client.query(
        'SELECT DISTINCT tenant_id FROM memberships WHERE user_id = $1',
        [u.id],
      );
      for (const t of tenants.rows) {
        await audit(client, t.tenant_id, 'user.set_email', u.id, {
          via: 'identity:strip-names',
        });
      }
      rewritten += 1;
    }
    const named = await client.query(
      `SELECT DISTINCT m.tenant_id, u.id FROM users u LEFT JOIN memberships m ON m.user_id = u.id
        WHERE u.display_name IS NOT NULL AND u.id <> $1`,
      [CLI_ACTOR_ID],
    );
    const cleared = await client.query(
      `UPDATE users SET display_name = NULL WHERE display_name IS NOT NULL`,
    );
    const seen = new Set();
    for (const r of named.rows) {
      if (!r.tenant_id || seen.has(`${r.tenant_id}:${r.id}`)) continue;
      seen.add(`${r.tenant_id}:${r.id}`);
      await audit(client, r.tenant_id, 'user.set_email', r.id, {
        via: 'identity:strip-names',
        cleared: 'display_name',
      });
    }
    const result = {
      applied: apply,
      namesCleared: cleared.rowCount ?? 0,
      addressesRewritten: rewritten,
    };
    if (!apply) throw new DryRun(result);
    return result;
  });
