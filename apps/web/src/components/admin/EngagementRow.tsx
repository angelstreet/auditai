import Link from 'next/link';
import type { AdminEngagementSummary } from '@/lib/adminData';
import { enumLabel, getT } from '@/lib/i18n';
import { formatDate, formatNumber } from '@evolai/i18n';
import type { TenantId } from '@evolai/contracts';

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
        <span>{summary.organisation.tradingName ?? summary.organisation.legalName}</span>
        <br />
        <Link href={`/admin/engagements/${summary.engagement.id}/analyses?tenant=${tenantId}`}>
          {summary.engagement.id}
        </Link>
      </th>
      <td>{enumLabel(t, 'engagementStatus', summary.engagement.status)}</td>
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
