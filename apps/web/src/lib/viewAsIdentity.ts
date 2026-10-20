import type { TenantId } from '@evolai/contracts';
import type { Translator } from '@evolai/i18n';
import type { Identity } from '@/components/chrome/HeaderControls';
import type { ViewAsMenu } from '@/components/chrome/ViewAsMenuSection';
import { tenantLabel } from './adminData';
import { emailLabel } from './identityLabel';
import { listPersonas } from './clientContext';
import type { SessionPayload } from './session';
import { effectiveContext, ownedTenantIds } from './tenantAccess';
import { viewAsRoleLabel } from './viewAsLabels';

/** The "View as" menu for a platform owner, or null for everyone else (ADR 0035). */
export const viewAsMenuFor = async (
  session: SessionPayload,
  t: Translator,
): Promise<ViewAsMenu | null> => {
  if (ownedTenantIds(session).length === 0) return null;
  let personas: Awaited<ReturnType<typeof listPersonas>> = [];
  try {
    personas = await listPersonas(session);
  } catch {
    personas = [];
  }
  const v = session.viewAs;
  const current = v
    ? personas.find(
        (p) =>
          p.viewAs.personaId === v.personaId &&
          p.viewAs.tenantId === v.tenantId &&
          p.viewAs.teamId === v.teamId,
      )
    : undefined;
  // While viewing as, only the way back and the current view are offered: no nested switch.
  const shown = v ? (current ? [current] : []) : personas;
  return {
    currentId: v ? (current?.id ?? 'unknown') : null,
    options: shown.map((p) => {
      const vars = {
        tenant: p.viewAs.tenantLabel,
        name: p.viewAs.label,
        role: viewAsRoleLabel(t, p.viewAs.role),
      };
      return {
        id: p.id,
        label: t('client.viewAs.persona', vars),
        aria: t('client.viewAs.personaAria', vars),
      };
    }),
  };
};

/**
 * Header identity in a client context: the persona while the owner views as one (initials, role
 * and organisation of the persona), or a real referent. Null for staff on their own view.
 */
export const clientIdentity = async (
  session: SessionPayload,
  t: Translator,
): Promise<Identity | null> => {
  const ctx = effectiveContext(session);
  if (ctx.kind !== 'client') return null;
  const v = ctx.viewAs;
  let organisation: string | null = v?.tenantLabel ?? null;
  if (!organisation) {
    try {
      organisation = await tenantLabel(ctx.tenantId as TenantId);
    } catch {
      organisation = null;
    }
  }
  return {
    name: v ? v.label : emailLabel(session.email) || t('common.account.roles.other'),
    email: v ? null : (session.email ?? null),
    role: viewAsRoleLabel(t, ctx.role),
    organisation,
    organisationCount: 1,
    workspaceHref: '/client',
    viewAs: await viewAsMenuFor(session, t),
  };
};
