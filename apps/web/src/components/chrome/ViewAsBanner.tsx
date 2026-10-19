import { cookies } from 'next/headers';
import { getSession } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { viewAsRoleLabel } from '@/lib/viewAsLabels';
import { VIEW_AS_SEEN_COOKIE } from '@/lib/viewAsSeen';
import ViewAsBannerBar from './ViewAsBannerBar';

/**
 * Sticky banner under the header while the owner views the app as a client persona (TASK-P,
 * docs/UI_RULES.md §14). One line, an icon, the read-only notice and one way back. It is rendered
 * from the signed session on the server, so it shows on every page of the view-as. After the first
 * page of a view-as, phones get a compact single line with a details toggle (TASK-S, item 14); the
 * "seen" cookie only holds the persona id and carries no authority.
 */
export default async function ViewAsBanner() {
  const session = await getSession();
  const v = session?.viewAs;
  if (!v) return null;
  const { t } = getT();
  const role = viewAsRoleLabel(t, v.role);
  return (
    <ViewAsBannerBar
      personaId={v.personaId}
      compact={cookies().get(VIEW_AS_SEEN_COOKIE)?.value === v.personaId}
      text={t('client.viewAs.banner', { tenant: v.tenantLabel, name: v.label, role })}
      short={t('client.viewAs.bannerShort', { name: v.label })}
    />
  );
}
