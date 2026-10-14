import { engagementStatusLabel, type AdminEngagementSummary } from '@/lib/adminData';

interface Props {
  summary: AdminEngagementSummary;
}

/**
 * One row in the admin engagements table. Pure server component; the page passes the summary
 * computed by `summariseEngagement`. Numbers come from the in-memory snapshot in M6; Phase 2
 * will swap the snapshot for a Postgres query that joins engagements / invitations / submissions.
 */
export default function EngagementRow({ summary }: Props) {
  const submittedPct = Math.round(summary.completionRatio * 100);
  return (
    <tr>
      <th scope="row">
        <span>{summary.organisation.tradingName ?? summary.organisation.legalName}</span>
        <br />
        <span className="muted">{summary.engagement.id}</span>
      </th>
      <td>{engagementStatusLabel(summary.engagement.status)}</td>
      <td>{summary.expectedHeadcount}</td>
      <td>{summary.invitationsTotal}</td>
      <td>{summary.invitationsSubmitted}</td>
      <td>{summary.invitationsOpened}</td>
      <td>{summary.invitationsPending}</td>
      <td>{summary.invitationsRevokedOrExpired}</td>
      <td>
        <strong>{submittedPct}%</strong>
        <span className="muted">
          {' '}
          ({summary.invitationsSubmitted} / {summary.expectedHeadcount})
        </span>
      </td>
      <td>{summary.engagement.closesAt ? formatDate(summary.engagement.closesAt) : '\u2014'}</td>
    </tr>
  );
}

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(0, 10);
};
