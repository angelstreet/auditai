import type { TenantId, UserId } from '@evolai/contracts';
import { getSession, requestPath } from './authServer';
import { loadClientSurvey } from './clientData';
import { InvitationError, createBatch } from './invitationData';
import { isUuid } from './invitationForm';
import { effectiveContext } from './tenantAccess';
import { auditViewAs } from './viewAsAudit';
import type { ClientActionState } from './clientActionState';

export const CLIENT_MAX_LINKS = 500;

export type { ClientActionState } from './clientActionState';

/** Pure count check: a whole number of people between 1 and 500. */
export const parseLinkCount = (raw: unknown): number | null => {
  const n = Number(String(raw ?? '').trim());
  return Number.isInteger(n) && n >= 1 && n <= CLIENT_MAX_LINKS ? n : null;
};

/**
 * Create survey links for the referent's own team (TASK-P). Tenant, team, engagement and actor
 * come from the signed session and the database; the form only carries the count and, when the
 * referent has several teams, which of their teams. A view-as session is refused: read only.
 */
export const createClientLinks = async (fd: FormData): Promise<ClientActionState> => {
  const session = await getSession();
  if (!session) return { ok: false, code: 'forbidden' };
  const ctx = effectiveContext(session);
  if (ctx.kind !== 'client') return { ok: false, code: 'forbidden' };
  if (ctx.viewAs || ctx.readOnly) {
    if (ctx.viewAs) {
      await auditViewAs(session, ctx.viewAs, 'view_as.refused', { path: requestPath() }).catch(
        () => undefined,
      );
    }
    return { ok: false, code: 'read_only' };
  }
  const count = parseLinkCount(fd.get('count'));
  if (count === null) return { ok: false, code: 'bad_count' };
  const survey = await loadClientSurvey(ctx.tenantId, ctx.teamIds);
  if (!survey || survey.teams.length === 0) return { ok: false, code: 'no_survey' };
  const asked = String(fd.get('teamId') ?? '');
  const team = survey.teams.find((x) => isUuid(asked) && x.id === asked) ?? survey.teams[0];
  if (!team || !ctx.teamIds.includes(team.id)) return { ok: false, code: 'forbidden' };
  try {
    const out = await createBatch({
      tenantId: ctx.tenantId as TenantId,
      engagementId: survey.engagementId,
      actor: session.sub as UserId,
      groups: [{ teamId: team.id, count }],
      expiresInDays: 14,
    });
    return { ok: true, code: 'created', count: out.invitations.length };
  } catch (err) {
    if (err instanceof InvitationError && err.code === 'bad_count') {
      return { ok: false, code: 'bad_count' };
    }
    return { ok: false, code: 'failed' };
  }
};
