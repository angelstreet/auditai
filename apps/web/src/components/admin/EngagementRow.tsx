import Link from 'next/link';
import type { AdminEngagementSummary } from '@/lib/adminData';
import { enumLabel, getT } from '@/lib/i18n';
import { formatDate, formatNumber } from '@evolai/i18n';
import { StatusText, type Status } from '@evolai/ui';
import type { TenantId } from '@evolai/contracts';

// Status as icon plus word (UI_RULES §4): still running is neutral, done is success.
const STATUS_ICON: Record<AdminEngagementSummary['engagement']['status'], Status> = {
  draft: 'pending',
  scheduled: 'pending',
  in_field: 'running',
  analysis: 'running',
  review: 'running',
  closed: 'success',
  archived: 'info',
};

interface Props {
  summary: AdminEngagementSummary;
  tenantId: TenantId;
}

/**
 * One row in the admin engagements table. Pure server component; the page passes the summary
 * computed by `summariseEngagement`. Numbers come from the in-memory snapshot in M6; Phase 2
 * will swap the snapshot for a Postgres query that joins engagements / invitations / submissions.
 *
 * M10 adds a "View analyses" link so the auditor can drill from the engagement list to the
 * per-engagement analysis review queue.
 */
export default function EngagementRow({ summary, tenantId }: Props) {
  const { t, locale } = getT();
  const submittedPct = formatNumber(locale, summary.completionRatio, {
    style: 'percent',
    maximumFractionDigits: 0,
  });
  return (
    <tr>
      <th scope="row">
        <Link href={`/admin/engagements/${summary.engagement.id}/analyses?tenant=${tenantId}`}>
          {summary.organisation.tradingName ?? summary.organisation.legalName}
        </Link>
      </th>
      <td>
        <StatusText status={STATUS_ICON[summary.engagement.status]}>
          {enumLabel(t, 'engagementStatus', summary.engagement.status)}
        </StatusText>
      </td>
      <td>{summary.expectedHeadcount}</td>
      <td>{summary.invitationsTotal}</td>
      <td>{summary.invitationsSubmitted}</td>
      <td>{summary.invitationsOpened}</td>
      <td>{summary.invitationsPending}</td>
      <td>{summary.invitationsRevokedOrExpired}</td>
      <td>
        <strong>{submittedPct}</strong>
        <span className="muted">
          {' '}
          ({summary.invitationsSubmitted} / {summary.expectedHeadcount})
        </span>
      </td>
      <td>
        {summary.engagement.closesAt
          ? formatDate(locale, summary.engagement.closesAt)
          : t('common.dash')}
      </td>
    </tr>
  );
}
