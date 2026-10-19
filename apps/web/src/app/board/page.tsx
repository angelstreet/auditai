import { Suspense } from 'react';
import Link from 'next/link';
import Button from '@mui/material/Button';
import { Mascot, PageTitle } from '@evolai/ui';
import AdminTabs from '@/components/admin/AdminTabs';
import FirstRunChecklist, { type ChecklistStep } from '@/components/admin/FirstRunChecklist';
import { listTeamsSetup } from '@/lib/setupData';
import { listEngagements } from '@/lib/adminData';
import { sessionTenantIds } from '@/lib/authServer';
import { listLatestSponsorBriefs } from '@/lib/sponsorBriefData';
import { listOpportunitiesForEngagement, opportunityStatusCounts } from '@/lib/opportunityData';
import { listSynergies } from '@/lib/synergyData';
import { listTeamBadges } from '@/lib/teamBadgeData';
import { enumLabel, getT } from '@/lib/i18n';
import type { AdminEngagementSummary } from '@/lib/adminData';
import type { TenantId } from '@evolai/contracts';

export const dynamic = 'force-dynamic';

interface BoardColumn {
  key: 'intake' | 'field' | 'review' | 'opps' | 'delivery';
  titleKey: 'colIntake' | 'colField' | 'colReview' | 'colOpps' | 'colDelivery';
  pulse: 'intake' | 'field' | 'review' | 'opps' | 'delivery';
}

const COLUMNS: ReadonlyArray<BoardColumn> = [
  { key: 'intake', titleKey: 'colIntake', pulse: 'intake' },
  { key: 'field', titleKey: 'colField', pulse: 'field' },
  { key: 'review', titleKey: 'colReview', pulse: 'review' },
  { key: 'opps', titleKey: 'colOpps', pulse: 'opps' },
  { key: 'delivery', titleKey: 'colDelivery', pulse: 'delivery' },
];

interface Ticket {
  column: BoardColumn['key'];
  title: string;
  meta: string;
  href: string;
  tone: 'amber' | 'teal' | 'blue' | 'supporting' | 'green';
  tier?: 'tortoise' | 'fox' | 'owl';
}

const engagementToColumn = (
  status: AdminEngagementSummary['engagement']['status'],
): BoardColumn['key'] => {
  switch (status) {
    case 'draft':
    case 'scheduled':
      return 'intake';
    case 'in_field':
      return 'field';
    case 'analysis':
    case 'review':
      return 'review';
    case 'closed':
    case 'archived':
      return 'delivery';
  }
};

export function generateMetadata() {
  return { title: getT().t('meta.pages.board') };
}

export default async function BoardPage() {
  const { t } = getT();
  const tenantIds = await sessionTenantIds();
  // Pull every engagement + opportunity count + sponsor brief + synergy + team-badge rollup in parallel.
  const [engagementsPerTenant, synergiesPerTenant, teamBadgesPerTenant] = await Promise.all([
    Promise.all(
      tenantIds.map(async (tid) => ({
        tenantId: tid,
        engagements: await listEngagements(tid as TenantId),
      })),
    ),
    Promise.all(
      tenantIds.map(async (tid) => ({
        tenantId: tid,
        synergies: await listSynergies(tid as TenantId),
      })),
    ),
    Promise.all(
      tenantIds.map(async (tid) => ({
        tenantId: tid,
        badges: await listTeamBadges(tid as TenantId),
      })),
    ),
  ]);
  const oppsPerEngagement = await Promise.all(
    engagementsPerTenant.flatMap(({ tenantId, engagements }) =>
      engagements.map(async (e) => ({
        tenantId,
        engagementId: e.engagement.id,
        counts: opportunityStatusCounts(
          await listOpportunitiesForEngagement(tenantId as TenantId, e.engagement.id),
        ),
      })),
    ),
  );
  const briefs = await listLatestSponsorBriefs();

  // First-run guide for the organisation being worked on (the header's organisation, ADR 0038).
  const working = tenantIds[0];
  const mine = engagementsPerTenant.find((x) => x.tenantId === working)?.engagements ?? [];
  const myTeams = working ? await listTeamsSetup(working as TenantId) : [];
  const q = working ? `tenant=${working}` : '';
  const firstId = mine[0]?.engagement.id;
  const inv = firstId ? `/admin/invitations?${q}&engagement=${firstId}` : `/admin/engagements?${q}`;
  const steps: ChecklistStep[] = [
    { key: 'Engagement', done: mine.length > 0, href: `/admin/engagements/new?${q}` },
    { key: 'Teams', done: myTeams.length > 0, href: `/admin/teams?${q}` },
    { key: 'Links', done: mine.some((e) => e.invitationsTotal > 0), href: inv },
    { key: 'Progress', done: mine.some((e) => e.invitationsSubmitted > 0), href: inv },
    {
      key: 'Results',
      done: mine.some((e) =>
        ['analysis', 'review', 'closed', 'archived'].includes(e.engagement.status),
      ),
      href: firstId ? `/admin/engagements/${firstId}/analyses?${q}` : `/admin/engagements?${q}`,
    },
  ];

  const tickets: Ticket[] = [];
  for (const { tenantId, engagements } of engagementsPerTenant) {
    for (const e of engagements) {
      const col = engagementToColumn(e.engagement.status);
      tickets.push({
        column: col,
        title: e.name ?? e.organisation.tradingName ?? e.organisation.legalName,
        meta: t('admin.board.submittedMeta', {
          submitted: e.invitationsSubmitted,
          expected: e.expectedHeadcount,
          status: enumLabel(t, 'engagementStatus', e.engagement.status),
        }),
        href: `/admin/engagements/${e.engagement.id}/analyses?tenant=${tenantId}`,
        tone: col === 'intake' ? 'supporting' : col === 'field' ? 'blue' : 'amber',
      });
    }
  }
  for (const { tenantId, engagementId, counts } of oppsPerEngagement) {
    if (counts.approved + counts.in_progress > 0) {
      tickets.push({
        column: 'opps',
        title: t('admin.board.activeOpps', { n: counts.approved + counts.in_progress }),
        meta: t('admin.board.oppsMeta', {
          approved: counts.approved,
          inProgress: counts.in_progress,
        }),
        href: `/admin/engagements/${engagementId}/opportunities?tenant=${tenantId}`,
        tone: 'teal',
      });
    }
    if (counts.delivered > 0) {
      tickets.push({
        column: 'delivery',
        title: t('admin.board.delivered', { n: counts.delivered }),
        meta: t('admin.board.closedLoop'),
        href: `/admin/engagements/${engagementId}/opportunities?tenant=${tenantId}`,
        tone: 'green',
      });
    }
  }
  for (const b of briefs) {
    tickets.push({
      column: 'intake',
      title: t('admin.board.briefTitle', { tenant: b.tenantName }),
      meta: b.topPriorityWorkflow.slice(0, 60) || t('admin.board.noPriority'),
      href: `/intake?tenant=${b.tenantId}`,
      tone: 'supporting',
    });
  }

  // Cross-team synergies appear on the Auditor review column.
  for (const s of synergiesPerTenant) {
    for (const sy of s.synergies) {
      tickets.push({
        column: 'review',
        title: t('admin.board.synergyTitle', {
          theme: sy.themeLabel.slice(0, 28),
          axis: enumLabel(t, 'axis', sy.axis),
        }),
        meta: t('admin.board.synergyMeta', {
          n: sy.occurrenceCount,
          status: enumLabel(t, 'synergyStatus', sy.status),
        }),
        href: `/admin/synergies?tenant=${s.tenantId}`,
        tone: 'amber',
      });
    }
  }

  // Team mascot rollups appear on Opportunities (analyst signal).
  for (const tb of teamBadgesPerTenant) {
    for (const b of tb.badges) {
      tickets.push({
        column: 'opps',
        title: `${(b as { teamName?: string }).teamName ?? t('admin.board.teamFallback')} ${t(`quiz.tier.${b.dominantTier}`)}`,
        tier: b.dominantTier,
        meta: t('admin.board.teamMeta', {
          n: b.memberCount,
          t: b.tortoiseCount,
          f: b.foxCount,
          o: b.owlCount,
        }),
        href: `/admin/teams?tenant=${tb.tenantId}`,
        tone: 'teal',
      });
    }
  }

  const grouped = COLUMNS.map((c) => ({
    col: c,
    items: tickets.filter((tk) => tk.column === c.key),
  }));

  const toneFor = (
    tone: 'amber' | 'teal' | 'blue' | 'supporting' | 'green',
    tier: 'tortoise' | 'fox' | 'owl' | null,
  ): string => {
    if (tier === 'tortoise') return 'supporting';
    if (tier === 'fox') return 'teal';
    if (tier === 'owl') return 'green';
    return tone;
  };

  return (
    <div className="wide">
      <Suspense fallback={null}>
        <AdminTabs />
      </Suspense>
      <PageTitle
        title={t('admin.board.title')}
        subtitle={t('admin.board.summary', {
          engagements: engagementsPerTenant.reduce((acc, x) => acc + x.engagements.length, 0),
          briefs: briefs.length,
        })}
        actions={
          <>
            <Button variant="text" href="/welcome">
              {t('admin.board.welcome')}
            </Button>
            <Button variant="outlined" href="/intake">
              {t('admin.board.openIntake')}
            </Button>
          </>
        }
      />
      {working && steps.some((s) => !s.done) ? <FirstRunChecklist steps={steps} /> : null}
      <div className="kanban">
        {grouped.map(({ col, items }) => (
          <section
            className={`col col-${col.pulse}`}
            key={col.key}
            aria-label={t(`admin.board.${col.titleKey}`)}
          >
            <h2>
              <span>
                <span className={`pulse ${col.pulse}`} />
                {t(`admin.board.${col.titleKey}`)}
              </span>
              <span className="count">{items.length}</span>
            </h2>
            {items.length === 0 ? (
              <p className="muted empty">{t('admin.board.empty')}</p>
            ) : (
              items.map((ticket, i) => {
                const tier = ticket.tier ?? null;
                return (
                  <Link
                    key={`${col.key}-${i}`}
                    href={ticket.href}
                    className={`ticket tone-${toneFor(ticket.tone, tier)}`}
                  >
                    {tier ? (
                      <Mascot tier={tier} size={32} label={t(`quiz.mascotAlt.${tier}`)} />
                    ) : null}
                    <div>
                      <div className="t">{ticket.title}</div>
                      <div className="meta">{ticket.meta}</div>
                    </div>
                  </Link>
                );
              })
            )}
          </section>
        ))}
      </div>
      <p className="footnote">{t('admin.board.footnote', { delivered: t('status.delivered') })}</p>
    </div>
  );
}
