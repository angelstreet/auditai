import { isUuid } from '@/lib/invitationForm';
import { redirectLegacy } from '@/lib/legacyRoute';

/** Links now live in the mission (TASK-AD2): /admin/engagements/<id>/invitations. */
export default function OldInvitationsPage({
  searchParams,
}: {
  searchParams: { tenant?: string; engagement?: string };
}) {
  const e = searchParams.engagement;
  redirectLegacy(
    e && isUuid(e) ? `/admin/engagements/${e}/invitations` : '/admin/engagements',
    searchParams.tenant,
  );
}
