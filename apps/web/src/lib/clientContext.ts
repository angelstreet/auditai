import { redirect } from 'next/navigation';
import type { TenantId } from '@evolai/contracts';
import { tenantLabel } from './adminData';
import { withServiceAccount } from './db';
import { getSession, requestPath } from './authServer';
import { VIEW_AS_ROLES, type SessionPayload, type ViewAs } from './session';
import { effectiveContext, ownedTenantIds, type EffectiveContext } from './tenantAccess';
import { auditViewAs } from './viewAsAudit';

export type ClientContext = Extract<EffectiveContext, { kind: 'client' }>;

/** Session and client context, or a redirect: staff to their surface, nobody to sign-in. */
const resolveClient = async (): Promise<{ session: SessionPayload; ctx: ClientContext }> => {
  const session = await getSession();
  if (!session) redirect('/login?next=/client');
  const ctx = effectiveContext(session);
  if (ctx.kind === 'staff') redirect('/admin/engagements');
  if (ctx.kind === 'none') redirect('/login');
  return { session, ctx };
};

/** For the /client layout: context plus the organisation label, without a trail row. */
export const clientContextOrRedirect = async (): Promise<{
  ctx: ClientContext;
  organisation: string;
}> => {
  const { ctx } = await resolveClient();
  const organisation =
    ctx.viewAs?.tenantLabel ?? (await tenantLabel(ctx.tenantId as TenantId).catch(() => ''));
  return { ctx, organisation };
};

/**
 * Entry check of every /client page and route (ADR 0035). Staff go back to their surface, a
 * missing session goes to sign-in. While the owner views as a persona, each call writes one
 * `view_as.request` row with the real actor and the path.
 */
export const requireClientContext = async (): Promise<{
  session: SessionPayload;
  ctx: ClientContext;
}> => {
  const { session, ctx } = await resolveClient();
  if (ctx.viewAs)
    await auditViewAs(session, ctx.viewAs, 'view_as.request', { path: requestPath() });
  return { session, ctx };
};

/** One entry of the "View as" menu: a client persona in a tenant the owner owns. */
export interface Persona {
  /** memberships.id: the only value the menu posts back; the server re-reads everything else. */
  readonly id: string;
  readonly viewAs: ViewAs;
}

const personaQuery = `
  SELECT m.id, m.role, m.tenant_id, m.team_id, m.user_id,
         u.display_name, t.display_name AS tenant_label, tm.name AS team_label
    FROM memberships m
    JOIN users u ON u.id = m.user_id
    JOIN tenants t ON t.id = m.tenant_id
    JOIN teams tm ON tm.id = m.team_id AND tm.tenant_id = m.tenant_id
   WHERE m.role = ANY($1::text[])
     AND m.tenant_id = ANY($2::uuid[])
     AND m.team_id IS NOT NULL
     AND (m.starts_at IS NULL OR m.starts_at <= now())
     AND (m.ends_at IS NULL OR m.ends_at > now())`;

/**
 * Personas the session may view as: client-role memberships in tenants where the session holds
 * platform owner. Empty for anyone else, and while a view-as is already running.
 */
export const listPersonas = async (
  session: SessionPayload,
  membershipId: string | null = null,
): Promise<Persona[]> => {
  const owned = ownedTenantIds(session);
  if (owned.length === 0) return [];
  return withServiceAccount(async (client) => {
    const { rows } = await client.query<{
      id: string;
      role: string;
      tenant_id: string;
      team_id: string;
      user_id: string;
      display_name: string;
      tenant_label: string;
      team_label: string;
    }>(
      `${personaQuery} ${membershipId ? 'AND m.id = $3' : ''}
        ORDER BY t.display_name, u.display_name, m.id`,
      membershipId ? [[...VIEW_AS_ROLES], owned, membershipId] : [[...VIEW_AS_ROLES], owned],
    );
    return rows.map((r) => ({
      id: r.id,
      viewAs: {
        role: r.role,
        tenantId: r.tenant_id,
        teamId: r.team_id,
        personaId: r.user_id,
        label: r.display_name.slice(0, 200),
        tenantLabel: r.tenant_label.slice(0, 200),
        teamLabel: r.team_label.slice(0, 200),
      },
    }));
  });
};
