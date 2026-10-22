import { notFound } from 'next/navigation';
import { isUuid } from '@/lib/invitationForm';
import { redirectLegacy } from '@/lib/legacyRoute';

/** Findings and actions live in the mission's Report tab (TASK-AD2, ADR 0049). */
export default function OldFindingsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tenant?: string };
}) {
  if (!isUuid(params.id)) notFound();
  redirectLegacy(`/admin/engagements/${params.id}/report`, searchParams.tenant);
}
