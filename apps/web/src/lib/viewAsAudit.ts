import type { TenantId } from '@evolai/contracts';
import { withTenant } from './db';
import type { SessionPayload, ViewAs } from './session';

export type ViewAsAction = 'view_as.start' | 'view_as.stop' | 'view_as.request' | 'view_as.refused';

/** Trail fields of a view-as row: who is shown, never anything the persona typed (ADR 0035). */
export const viewAsPayload = (
  viewAs: ViewAs,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  as_role: viewAs.role,
  as_tenant: viewAs.tenantId,
  as_team: viewAs.teamId,
  ...extra,
});

/**
 * Append one view-as row to the persona's tenant trail. The actor is always the real signed-in
 * user (`session.sub`); the persona is the target. Paths are kept without their query string.
 */
export const auditViewAs = async (
  session: SessionPayload,
  viewAs: ViewAs,
  action: ViewAsAction,
  extra: Record<string, unknown> = {},
): Promise<void> => {
  await withTenant(viewAs.tenantId as TenantId, async (client) => {
    await client.query(
      `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
       VALUES ($1, $2, $3, 'user', $4, $5)`,
      [
        viewAs.tenantId,
        session.sub,
        action,
        viewAs.personaId,
        JSON.stringify(viewAsPayload(viewAs, extra)),
      ],
    );
  });
};

/** Path for the trail: pathname only, bounded, so no token or query value lands in the log. */
export const trailPath = (raw: string | null | undefined): string =>
  (raw ?? '').split('?')[0]?.slice(0, 200) || '/';
