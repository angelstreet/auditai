import { notFound } from 'next/navigation';
import { isUuid } from '@/lib/invitationForm';
import { redirectLegacy } from '@/lib/legacyRoute';

/** The report editor is the mission's Report tab now (TASK-AD2). */
export default function OldReportEditorPage({
  params,
  searchParams,
}: {
  params: { engagementId: string };
  searchParams: { tenant?: string };
}) {
  if (!isUuid(params.engagementId)) notFound();
  redirectLegacy(`/admin/engagements/${params.engagementId}/report`, searchParams.tenant);
}
