import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Typography from '@mui/material/Typography';
import { EmptyState, PageTitle, StatTiles } from '@evolai/ui';
import { formatDate, formatNumber, messages } from '@evolai/i18n';
import { sessionTenantIds } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import {
  getSettings,
  listBatches,
  listEngagementTeams,
  linkTotals,
  listOpen,
  progress,
  reminderList,
} from '@/lib/invitationData';
import { isUuid } from '@/lib/invitationForm';
import { MIN_GROUP_SIZE, resolveBaseUrl } from '@/lib/invitationTracking';
import InvitationsPanel from '@/app/admin/invitations/InvitationsPanel';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
  searchParams: { tenant?: string };
}

/**
 * Invitations for one engagement (FR-03). Everything shown is aggregate or a bare link: no name,
 * no address, and nothing says which invitation was completed (PRD §15, §25.1).
 */
export default async function InvitationsPage({ params, searchParams }: Props) {
  const { t, locale } = getT();
  const copy = messages[locale].admin.invitations;
  const tenants = await sessionTenantIds();
  const tenantId = tenants.find((id) => id === searchParams.tenant) ?? tenants[0];
  if (!tenantId) {
    return (
      <section className="wide admin" aria-labelledby="inv-title">
        <PageTitle level="h2" id="inv-title" title={t('admin.invitations.title')} />
        <EmptyState title={t('admin.common.noTenantsTitle')} />
      </section>
    );
  }
  const engagementId = params.id;
  if (!isUuid(engagementId)) notFound();

  const h = headers();
  const baseUrl = resolveBaseUrl(
    process.env,
    h.get('x-forwarded-host') ?? h.get('host'),
    h.get('x-forwarded-proto'),
  );
  const [settings, teams, prog, open, due, batchList, totalsOfLinks] = await Promise.all([
    getSettings(tenantId, engagementId),
    listEngagementTeams(tenantId, engagementId),
    progress(tenantId, engagementId),
    listOpen(tenantId, engagementId, baseUrl),
    reminderList(tenantId, engagementId, baseUrl),
    listBatches(tenantId, engagementId),
    linkTotals(tenantId, engagementId),
  ]);
  if (!settings) {
    return (
      <section className="wide admin" aria-labelledby="inv-title">
        <PageTitle level="h2" id="inv-title" title={t('admin.invitations.title')} />
        <EmptyState title={t('admin.invitations.errors.engagement_not_found')} />
      </section>
    );
  }
  const fewer = t('admin.invitations.teams.fewerThan', { n: MIN_GROUP_SIZE });
  const pct = (n: number) => formatNumber(locale, n / 100, { style: 'percent' });
  const totals = prog.totals;
  const tiles = [
    {
      label: t('admin.invitations.tiles.invited'),
      value: String(prog.teams.reduce((n, r) => n + r.invited, 0)),
    },
    ...(totals
      ? [
          { label: t('admin.invitations.tiles.opened'), value: String(totals.opened) },
          { label: t('admin.invitations.tiles.started'), value: String(totals.started) },
          { label: t('admin.invitations.tiles.completed'), value: String(totals.completed) },
          { label: t('admin.invitations.tiles.rate'), value: pct(totals.completionRate) },
        ]
      : [
          {
            label: t('admin.invitations.tiles.rate'),
            value: t('admin.invitations.teams.hidden'),
          },
        ]),
  ];

  return (
    <section className="wide admin" aria-labelledby="inv-title">
      <PageTitle
        level="h2"
        id="inv-title"
        title={t('admin.invitations.title')}
        subtitle={t('admin.invitations.subtitle')}
      />
      <StatTiles items={tiles} />
      <Typography
        variant="body2"
        color="text.secondary"
        data-testid="invitation-counts"
        sx={{ mb: 4 }}
      >
        {t('admin.invitations.counts', {
          expected: totalsOfLinks.expected,
          created: totalsOfLinks.created,
          revoked: totalsOfLinks.revoked,
          invited: totalsOfLinks.created - totalsOfLinks.revoked,
        })}
      </Typography>
      <InvitationsPanel
        copy={copy}
        fewer={fewer}
        minGroup={MIN_GROUP_SIZE}
        tenantId={tenantId}
        engagementId={engagementId}
        emailDelivery={settings.emailDelivery}
        reminderDays={settings.reminderDays.join(', ')}
        closesOn={settings.closesOn ?? ''}
        contact={settings.contact ?? ''}
        teams={teams}
        progress={prog.teams.map((r) => ({
          teamId: r.teamId,
          teamName: r.teamName,
          invited: r.invited,
          suppressed: r.suppressed,
          completionRate: r.suppressed ? 0 : r.completionRate,
          completed: r.suppressed ? 0 : r.completed,
          lastActivityOn:
            r.suppressed || !r.lastActivityOn ? null : formatDate(locale, r.lastActivityOn),
        }))}
        open={open.map((o) => ({
          id: o.id,
          code: o.code,
          teamName: o.teamName,
          expiresOn: formatDate(locale, o.expiresOn),
          link: o.link,
        }))}
        dueCount={due.length}
        batches={batchList.map((b) => ({
          batchId: b.batchId,
          label: t('admin.invitations.batches.label', {
            n: b.total,
            date: formatDate(locale, b.createdOn),
          }),
          stillOpen: t('admin.invitations.batches.stillOpen', { n: b.open }),
          canRevoke: b.open > 0,
        }))}
      />
    </section>
  );
}
