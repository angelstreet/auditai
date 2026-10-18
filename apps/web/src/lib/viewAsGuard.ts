import { getSession, requestPath } from './authServer';
import { getT } from './i18n';
import { auditViewAs } from './viewAsAudit';

/**
 * Read-only guard for writes that do not go through `resolveActor` (public forms and the survey
 * answer route). While the request carries a view-as session, the write is refused with the
 * read-only message and the attempt is trailed (ADR 0035). Returns null when the write may go on.
 */
export const viewAsRefusal = async (path?: string): Promise<string | null> => {
  const session = await getSession().catch(() => null);
  if (!session?.viewAs) return null;
  await auditViewAs(session, session.viewAs, 'view_as.refused', {
    path: path ?? requestPath(),
  }).catch(() => undefined);
  return getT().t('client.viewAs.readOnly');
};
