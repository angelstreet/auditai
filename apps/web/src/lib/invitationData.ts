import { randomBytes, randomUUID } from 'node:crypto';
import type { TenantId, UserId } from '@evolai/contracts';
import type pg from 'pg';
import { withServiceAccount, withTenant } from './db';
import { signInviteToken } from './invitationToken';
import { decryptAddress, encryptAddress } from './invitationCrypto';
import {
  applyMinGroup,
  engagementTotals,
  isReminderDue,
  parseReminderDays,
  surveyLink,
  MAX_REMINDERS_PER_RUN,
  type EngagementTotals,
  type TeamCounts,
  type TeamProgressRow,
} from './invitationTracking';

/**
 * Invitation administration (FR-03, ADR 0033). Everything here is tenant-scoped (withTenant, RLS)
 * except the optional delivery addresses, which live in a service-account-only table.
 *
 * Privacy rules enforced in this file:
 *  - default mode stores no email address and no name;
 *  - progress is computed from `invitations` only, never joined to submissions or answers;
 *  - the only per-invitation listing is "not yet completed", with a short opaque code, no status.
 */

const SYSTEM_ACTOR = '00000000-0000-4000-8000-000000000000';
export const MAX_BATCH = 2000;
export const MAX_ADDRESSES_PER_BATCH = 200;
const OPEN_STATUSES = "('pending','opened','in_progress')";

export class InvitationError extends Error {
  public constructor(
    public readonly code:
      | 'engagement_not_found'
      | 'engagement_closed'
      | 'team_not_in_engagement'
      | 'bad_count'
      | 'bad_expiry'
      | 'email_off'
      | 'not_found'
      | 'not_open',
  ) {
    super(code);
    this.name = 'InvitationError';
  }
}

export interface EngagementSettings {
  readonly emailDelivery: boolean;
  readonly reminderDays: readonly number[];
  readonly status: string;
  readonly locale: 'fr' | 'en';
}

const newReference = (): string => `i${randomBytes(18).toString('base64url')}`;
const newPseudonym = (): string => `p-${randomBytes(8).toString('hex')}`;

export const tokenFor = (reference: string): string => signInviteToken(reference);

const audit = async (
  client: pg.PoolClient,
  tenantId: string,
  actor: string,
  action: string,
  targetKind: 'invitation' | 'engagement',
  targetId: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  await client.query(
    `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, actor, action, targetKind, targetId, JSON.stringify(payload)],
  );
};

export const getSettings = async (
  tenantId: TenantId,
  engagementId: string,
): Promise<EngagementSettings | null> =>
  withTenant(tenantId, async (client) => readSettings(client, tenantId, engagementId));

const readSettings = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<EngagementSettings | null> => {
  const { rows } = await client.query<{
    status: string;
    locale: string;
    privacy_json: Record<string, unknown>;
  }>(`SELECT status, locale, privacy_json FROM engagements WHERE tenant_id = $1 AND id = $2`, [
    tenantId,
    engagementId,
  ]);
  const row = rows[0];
  if (!row) return null;
  return {
    emailDelivery: row.privacy_json['emailDelivery'] === true,
    reminderDays: parseReminderDays(row.privacy_json['reminderDays']),
    status: row.status,
    locale: row.locale === 'fr' ? 'fr' : 'en',
  };
};

export const listEngagementTeams = async (
  tenantId: TenantId,
  engagementId: string,
): Promise<{ id: string; name: string }[]> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ id: string; name: string }>(
      `SELECT t.id, t.name FROM engagement_teams et JOIN teams t ON t.id = et.team_id
        WHERE et.tenant_id = $1 AND et.engagement_id = $2 ORDER BY t.name`,
      [tenantId, engagementId],
    );
    return rows;
  });

export const updateSettings = async (
  tenantId: TenantId,
  engagementId: string,
  actor: UserId,
  patch: { emailDelivery: boolean; reminderDays: readonly number[] },
): Promise<void> =>
  withTenant(tenantId, async (client) => {
    const res = await client.query(
      `UPDATE engagements
          SET privacy_json = privacy_json || $3::jsonb, updated_at = now()
        WHERE tenant_id = $1 AND id = $2`,
      [
        tenantId,
        engagementId,
        JSON.stringify({ emailDelivery: patch.emailDelivery, reminderDays: patch.reminderDays }),
      ],
    );
    if (res.rowCount === 0) throw new InvitationError('engagement_not_found');
    await audit(client, tenantId, actor, 'invitation.settings', 'engagement', engagementId, {
      emailDelivery: patch.emailDelivery,
      reminderDays: patch.reminderDays,
    });
  });

export interface BatchGroup {
  readonly teamId: string;
  readonly count: number;
}
export interface CreatedInvitation {
  readonly id: string;
  readonly teamName: string;
  readonly token: string;
  readonly expiresAt: string;
}

export interface BatchInput {
  readonly tenantId: TenantId;
  readonly engagementId: string;
  readonly actor: UserId;
  readonly groups: readonly BatchGroup[];
  readonly expiresInDays: number;
  /** Email mode only: one address per invitation, paired positionally with the created rows. */
  readonly addresses?: readonly { teamId: string; address: string }[];
}

/** Bulk-create invitations. No names, no addresses unless the engagement switched email on. */
export const createBatch = async (
  input: BatchInput,
): Promise<{ invitations: CreatedInvitation[]; deliveries: { id: string; address: string }[] }> => {
  const { tenantId, engagementId, actor, expiresInDays } = input;
  if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 90) {
    throw new InvitationError('bad_expiry');
  }
  // Addresses become one group entry per address so counts and links stay aligned.
  const addressList = input.addresses ?? [];
  const groups: BatchGroup[] = [...input.groups];
  for (const a of addressList) groups.push({ teamId: a.teamId, count: 1 });
  const total = groups.reduce((s, g) => s + g.count, 0);
  if (
    groups.some((g) => !Number.isInteger(g.count) || g.count < 1) ||
    total < 1 ||
    total > MAX_BATCH
  ) {
    throw new InvitationError('bad_count');
  }
  if (addressList.length > MAX_ADDRESSES_PER_BATCH) throw new InvitationError('bad_count');

  const created = await withTenant(tenantId, async (client) => {
    const settings = await readSettings(client, tenantId, engagementId);
    if (!settings) throw new InvitationError('engagement_not_found');
    if (!['draft', 'scheduled', 'in_field'].includes(settings.status)) {
      throw new InvitationError('engagement_closed');
    }
    if (addressList.length > 0 && !settings.emailDelivery) throw new InvitationError('email_off');
    const teams = await client.query<{ id: string; name: string }>(
      `SELECT t.id, t.name FROM engagement_teams et JOIN teams t ON t.id = et.team_id
        WHERE et.tenant_id = $1 AND et.engagement_id = $2`,
      [tenantId, engagementId],
    );
    const names = new Map(teams.rows.map((t) => [t.id, t.name]));
    if (groups.some((g) => !names.has(g.teamId)))
      throw new InvitationError('team_not_in_engagement');
    const expires = new Date(Date.now() + expiresInDays * 86_400_000);
    const out: CreatedInvitation[] = [];
    for (const g of groups) {
      for (let i = 0; i < g.count; i += 1) {
        const id = randomUUID();
        const reference = newReference();
        const token = tokenFor(reference);
        await client.query(
          `INSERT INTO invitations (id, tenant_id, engagement_id, team_id, respondent_pseudonym,
                                    status, token_reference, token_signature, opens_at, expires_at,
                                    created_by)
           VALUES ($1,$2,$3,$4,$5,'pending',$6,$7, now(), $8, $9)`,
          [
            id,
            tenantId,
            engagementId,
            g.teamId,
            newPseudonym(),
            reference,
            token.split('.')[1],
            expires,
            actor,
          ],
        );
        out.push({
          id,
          teamName: names.get(g.teamId) as string,
          token,
          expiresAt: expires.toISOString(),
        });
      }
    }
    await audit(client, tenantId, actor, 'invitation.create_batch', 'engagement', engagementId, {
      count: out.length,
      teams: groups.length,
      expiresInDays,
      withAddresses: addressList.length,
    });
    return out;
  });

  // Addresses were appended last, in order: pair them with the tail of the created rows.
  const deliveries: { id: string; address: string }[] = [];
  if (addressList.length > 0) {
    const tail = created.slice(created.length - addressList.length);
    await withServiceAccount(async (client) => {
      for (let i = 0; i < addressList.length; i += 1) {
        const inv = tail[i] as CreatedInvitation;
        const address = (addressList[i] as { address: string }).address;
        await client.query(
          `INSERT INTO invitation_deliveries (invitation_id, tenant_id, address_cipher, purge_after)
           VALUES ($1, $2, $3, $4)`,
          [
            inv.id,
            tenantId,
            encryptAddress(address, inv.id),
            new Date(new Date(inv.expiresAt).getTime() + 86_400_000),
          ],
        );
        deliveries.push({ id: inv.id, address });
      }
    });
  }
  return { invitations: created, deliveries };
};

export interface Progress {
  readonly teams: TeamProgressRow[];
  readonly totals: EngagementTotals | null;
}

/** Counts per team from `invitations` alone. Revoked invitations are not counted as invited. */
export const progress = async (tenantId: TenantId, engagementId: string): Promise<Progress> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      team_id: string;
      team_name: string;
      invited: number;
      opened: number;
      started: number;
      completed: number;
      last_activity_on: string | null;
    }>(
      `SELECT i.team_id, t.name AS team_name,
              COUNT(*)::int AS invited,
              COUNT(*) FILTER (WHERE i.status IN ('opened','in_progress','submitted'))::int AS opened,
              COUNT(*) FILTER (WHERE i.status IN ('in_progress','submitted'))::int AS started,
              COUNT(*) FILTER (WHERE i.status = 'submitted')::int AS completed,
              to_char(MAX(i.last_activity_on), 'YYYY-MM-DD') AS last_activity_on
         FROM invitations i JOIN teams t ON t.id = i.team_id
        WHERE i.tenant_id = $1 AND i.engagement_id = $2 AND i.status <> 'revoked'
        GROUP BY i.team_id, t.name ORDER BY t.name`,
      [tenantId, engagementId],
    );
    const counts: TeamCounts[] = rows.map((r) => ({
      teamId: r.team_id,
      teamName: r.team_name,
      invited: r.invited,
      opened: r.opened,
      started: r.started,
      completed: r.completed,
      lastActivityOn: r.last_activity_on,
    }));
    return { teams: applyMinGroup(counts), totals: engagementTotals(counts) };
  });

export interface OpenInvitation {
  readonly id: string;
  readonly code: string;
  readonly teamName: string;
  readonly expiresOn: string;
  readonly link: string;
}

/** Links of invitations not yet completed (and not revoked), for export and for resending. */
export const listOpen = async (
  tenantId: TenantId,
  engagementId: string,
  baseUrl: string,
): Promise<OpenInvitation[]> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      id: string;
      token_reference: string;
      team_name: string;
      expires_on: string;
    }>(
      `SELECT i.id, i.token_reference, t.name AS team_name, to_char(i.expires_at, 'YYYY-MM-DD') AS expires_on
         FROM invitations i JOIN teams t ON t.id = i.team_id
        WHERE i.tenant_id = $1 AND i.engagement_id = $2 AND i.status IN ${OPEN_STATUSES}
        ORDER BY t.name, i.created_at, i.id`,
      [tenantId, engagementId],
    );
    return rows.map((r) => ({
      id: r.id,
      code: r.token_reference.slice(-6),
      teamName: r.team_name,
      expiresOn: r.expires_on,
      link: surveyLink(baseUrl, tokenFor(r.token_reference)),
    }));
  });

interface DueRow {
  id: string;
  token_reference: string;
  team_name: string;
  status: string;
  created_on: string;
  expires_at: string;
  reminder_count: number;
}

const loadDue = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
  schedule: readonly number[],
  now: Date,
): Promise<DueRow[]> => {
  const { rows } = await client.query<DueRow>(
    `SELECT i.id, i.token_reference, t.name AS team_name, i.status,
            to_char(i.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS created_on,
            i.expires_at, i.reminder_count
       FROM invitations i JOIN teams t ON t.id = i.team_id
      WHERE i.tenant_id = $1 AND i.engagement_id = $2 AND i.status IN ${OPEN_STATUSES}
        AND i.expires_at > now() AND i.reminder_count < $3
      ORDER BY i.created_at, i.id`,
    [tenantId, engagementId, schedule.length],
  );
  return rows.filter((r) =>
    isReminderDue(
      {
        status: r.status,
        createdOn: r.created_on,
        expiresAt: r.expires_at,
        reminderCount: r.reminder_count,
      },
      schedule,
      now,
    ),
  );
};

/** No-email mode: the reminder list the client can resend. Links only, no identity. */
export const reminderList = async (
  tenantId: TenantId,
  engagementId: string,
  baseUrl: string,
  now: Date = new Date(),
): Promise<OpenInvitation[]> =>
  withTenant(tenantId, async (client) => {
    const settings = await readSettings(client, tenantId, engagementId);
    if (!settings) return [];
    const due = await loadDue(client, tenantId, engagementId, settings.reminderDays, now);
    return due.map((r) => ({
      id: r.id,
      code: r.token_reference.slice(-6),
      teamName: r.team_name,
      expiresOn: r.expires_at.slice(0, 10),
      link: surveyLink(baseUrl, tokenFor(r.token_reference)),
    }));
  });

/** Admin confirms the list was resent: consumes the current reminder step. Idempotent. */
export const markReminded = async (
  tenantId: TenantId,
  engagementId: string,
  actor: UserId,
  now: Date = new Date(),
): Promise<number> =>
  withTenant(tenantId, async (client) => {
    const settings = await readSettings(client, tenantId, engagementId);
    if (!settings) throw new InvitationError('engagement_not_found');
    const due = await loadDue(client, tenantId, engagementId, settings.reminderDays, now);
    if (due.length === 0) return 0;
    await client.query(
      `UPDATE invitations SET reminder_count = reminder_count + 1, last_reminder_on = current_date,
              updated_at = now()
        WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
      [tenantId, due.map((d) => d.id)],
    );
    await audit(client, tenantId, actor, 'invitation.remind', 'engagement', engagementId, {
      mode: 'list',
      count: due.length,
    });
    return due.length;
  });

export const revoke = async (
  tenantId: TenantId,
  invitationId: string,
  actor: UserId,
): Promise<void> =>
  withTenant(tenantId, async (client) => {
    const res = await client.query<{ engagement_id: string }>(
      `UPDATE invitations SET status = 'revoked', revoked_at = now(), updated_at = now()
        WHERE tenant_id = $1 AND id = $2 AND status IN ${OPEN_STATUSES}
        RETURNING engagement_id`,
      [tenantId, invitationId],
    );
    if (res.rowCount === 0) throw new InvitationError('not_open');
    await audit(client, tenantId, actor, 'invitation.revoke', 'invitation', invitationId, {
      engagementId: res.rows[0]?.engagement_id,
    });
  }).then(() => purgeDelivery(tenantId, invitationId));

export const extend = async (
  tenantId: TenantId,
  invitationId: string,
  actor: UserId,
  days: number,
): Promise<void> => {
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new InvitationError('bad_expiry');
  await withTenant(tenantId, async (client) => {
    const res = await client.query(
      `UPDATE invitations
          SET expires_at = GREATEST(expires_at, now()) + make_interval(days => $3),
              status = CASE WHEN status = 'expired' THEN 'pending' ELSE status END,
              updated_at = now()
        WHERE tenant_id = $1 AND id = $2 AND status IN ('pending','opened','in_progress','expired')`,
      [tenantId, invitationId, days],
    );
    if (res.rowCount === 0) throw new InvitationError('not_open');
    await audit(client, tenantId, actor, 'invitation.extend', 'invitation', invitationId, { days });
  });
  await withServiceAccount((c) =>
    c.query(
      `UPDATE invitation_deliveries d SET purge_after = i.expires_at + interval '1 day'
         FROM invitations i WHERE d.invitation_id = i.id AND i.id = $1 AND i.tenant_id = $2`,
      [invitationId, tenantId],
    ),
  );
};

/** Lost link: a new reference replaces the old one, so the old link stops working at once. */
export const regenerate = async (
  tenantId: TenantId,
  invitationId: string,
  actor: UserId,
  baseUrl: string,
): Promise<string> =>
  withTenant(tenantId, async (client) => {
    const reference = newReference();
    const token = tokenFor(reference);
    const res = await client.query(
      `UPDATE invitations SET token_reference = $3, token_signature = $4, updated_at = now()
        WHERE tenant_id = $1 AND id = $2 AND status IN ${OPEN_STATUSES}`,
      [tenantId, invitationId, reference, token.split('.')[1]],
    );
    if (res.rowCount === 0) throw new InvitationError('not_open');
    await audit(client, tenantId, actor, 'invitation.regenerate', 'invitation', invitationId, {});
    return surveyLink(baseUrl, token);
  });

export const purgeDelivery = async (tenantId: string, invitationId: string): Promise<void> => {
  await withServiceAccount((c) =>
    c.query(`DELETE FROM invitation_deliveries WHERE tenant_id = $1 AND invitation_id = $2`, [
      tenantId,
      invitationId,
    ]),
  );
};

export { SYSTEM_ACTOR, decryptAddress, MAX_REMINDERS_PER_RUN };

/** Export helper: list the links and write one audit row (counts only). */
export const withAudit = async (
  tenantId: string,
  engagementId: string,
  actor: string,
  kind: 'all' | 'reminders',
  baseUrl: string,
): Promise<OpenInvitation[]> => {
  const rows =
    kind === 'reminders'
      ? await reminderList(tenantId as TenantId, engagementId, baseUrl)
      : await listOpen(tenantId as TenantId, engagementId, baseUrl);
  await withTenant(tenantId as TenantId, (client) =>
    audit(client, tenantId, actor, 'invitation.export', 'engagement', engagementId, {
      kind,
      count: rows.length,
    }),
  );
  return rows;
};
