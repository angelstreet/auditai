import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Mascot } from '@auditai/ui';
import { listEngagements, listTenantIds } from '@/lib/adminData';
import { listLatestSponsorBriefs } from '@/lib/sponsorBriefData';
import { listOpportunitiesForEngagement, opportunityStatusCounts } from '@/lib/opportunityData';
import { listSynergies } from '@/lib/synergyData';
import { listTeamBadges } from '@/lib/teamBadgeData';
import { OPPORTUNITY_STATUS_LABELS } from '@auditai/contracts';
import type { AdminEngagementSummary } from '@/lib/adminData';
import type { TenantId } from '@auditai/contracts';

export const dynamic = 'force-dynamic';

interface BoardColumn {
  key: 'intake' | 'field' | 'review' | 'opps' | 'delivery';
  title: string;
  pulse: 'intake' | 'field' | 'review' | 'opps' | 'delivery';
}

const COLUMNS: ReadonlyArray<BoardColumn> = [
  { key: 'intake', title: 'Intake', pulse: 'intake' },
  { key: 'field', title: 'Field', pulse: 'field' },
  { key: 'review', title: 'Auditor review', pulse: 'review' },
  { key: 'opps', title: 'Opportunities', pulse: 'opps' },
  { key: 'delivery', title: 'Delivery', pulse: 'delivery' },
];

interface Ticket {
  column: BoardColumn['key'];
  title: string;
  meta: string;
  href: string;
  tone: 'amber' | 'teal' | 'blue' | 'supporting' | 'green';
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

export default async function BoardPage() {
  const tenantIds = await listTenantIds();
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

  const tickets: Ticket[] = [];
  for (const { tenantId, engagements } of engagementsPerTenant) {
    for (const e of engagements) {
      const col = engagementToColumn(e.engagement.status);
      tickets.push({
        column: col,
        title: `${e.organisation.tradingName ?? e.organisation.legalName}`,
        meta: `${e.invitationsSubmitted} / ${e.expectedHeadcount} submitted \u00b7 ${e.engagement.status}`,
        href: `/admin/engagements/${e.engagement.id}/analyses?tenant=${tenantId}`,
        tone: col === 'intake' ? 'supporting' : col === 'field' ? 'blue' : 'amber',
      });
    }
  }
  for (const { tenantId, engagementId, counts } of oppsPerEngagement) {
    if (counts.approved + counts.in_progress > 0) {
      tickets.push({
        column: 'opps',
        title: `${counts.approved + counts.in_progress} active opportunit${counts.approved + counts.in_progress === 1 ? 'y' : 'ies'}`,
        meta: `${counts.approved} approved \u00b7 ${counts.in_progress} in progress`,
        href: `/admin/engagements/${engagementId}/opportunities?tenant=${tenantId}`,
        tone: 'teal',
      });
    }
    if (counts.delivered > 0) {
      tickets.push({
        column: 'delivery',
        title: `${counts.delivered} delivered`,
        meta: 'closed loop',
        href: `/admin/engagements/${engagementId}/opportunities?tenant=${tenantId}`,
        tone: 'green',
      });
    }
  }
  for (const b of briefs) {
    tickets.push({
      column: 'intake',
      title: `${b.tenantName} sponsor brief`,
      meta: b.topPriorityWorkflow.slice(0, 60) || 'no priority set',
      href: `/intake?tenant=${b.tenantId}`,
      tone: 'supporting',
    });
  }

  // Cross-team synergies appear on the Auditor review column.
  for (const s of synergiesPerTenant) {
    for (const sy of s.synergies) {
      tickets.push({
        column: 'review',
        title: `${sy.themeLabel.slice(0, 28)} (${sy.axis} recurring)`,
        meta: `${sy.occurrenceCount} engagement(s) \u00b7 ${sy.status}`,
        href: `/admin/synergies?tenant=${s.tenantId}`,
        tone: 'amber',
      });
    }
  }

  // Team mascot rollups appear on Opportunities (analyst signal).
  for (const t of teamBadgesPerTenant) {
    for (const b of t.badges) {
      tickets.push({
        column: 'opps',
        title: `${(b as { teamName?: string }).teamName ?? 'team'} ${b.dominantTier}`,
        meta: `${b.memberCount} member(s) \u00b7 ${b.tortoiseCount}/${b.foxCount}/${b.owlCount}`,
        href: `/admin/teams?tenant=${t.tenantId}`,
        tone: 'teal',
      });
    }
  }

  const grouped = COLUMNS.map((c) => ({
    col: c,
    items: tickets.filter((t) => t.column === c.key),
  }));

  const toneFor = (
    t: 'amber' | 'teal' | 'blue' | 'supporting' | 'green',
    tier: 'tortoise' | 'fox' | 'owl' | null,
  ): string => {
    if (tier === 'tortoise') return 'supporting';
    if (tier === 'fox') return 'teal';
    if (tier === 'owl') return 'green';
    return t;
  };

  return (
    <main className="container">
      <Logo />
      <h1 style={{ marginTop: 'var(--space-4)' }}>Portfolio board</h1>
      <p className="muted">
        {engagementsPerTenant.reduce((acc, x) => acc + x.engagements.length, 0)} engagement(s),{' '}
        {briefs.length} sponsor brief(s). Each card is a single line; the per-axis tier bench bars
        are the only quantitative signal on the team profile page.
      </p>
      <p>
        <Link className="btn-ghost" href="/welcome">
          \u2190 Welcome
        </Link>{' '}
        <Link className="btn-ghost" href="/intake">
          Open intake
        </Link>
      </p>
      <div className="kanban">
        {grouped.map(({ col, items }) => (
          <section className={`col col-${col.pulse}`} key={col.key} aria-label={col.title}>
            <h4>
              <span>
                <span className={`pulse ${col.pulse}`} />
                {col.title}
              </span>
              <span className="count">{items.length}</span>
            </h4>
            {items.length === 0 ? (
              <p className="muted empty">No cards in this column.</p>
            ) : (
              items.map((t, i) => {
                const tierMatch =
                  col.key === 'opps' ? /( tortoise| fox| owl)$/.exec(t.title) : null;
                const match = tierMatch?.[1] ? tierMatch[1].trim() : '';
                const tier: 'tortoise' | 'fox' | 'owl' | null =
                  match === 'tortoise' || match === 'fox' || match === 'owl'
                    ? match
                    : null;
                return (
                  <Link
                    key={`${col.key}-${i}`}
                    href={t.href}
                    className={`ticket tone-${toneFor(t.tone, tier)}`}
                  >
                    {tier ? <Mascot tier={tier} size={32} /> : null}
                    <div className="t">{t.title}</div>
                    <div className="meta">
                      <span className="axis">{col.title}</span>
                      <span className="resp">{t.meta}</span>
                    </div>
                  </Link>
                );
              })
            )}
          </section>
        ))}
      </div>
      <p className="footnote">
        <strong>What this shows.</strong> Intake cards are sponsor briefs (M12); field / review
        cards are engagements (M6); opportunities cards count from the
        <code>opportunities</code> table (M11); delivery cards count the
        <code>{OPPORTUNITY_STATUS_LABELS.delivered}</code> rows. No raw numbers on this surface.
      </p>
      <style>{`
        .kanban { display: grid; grid-template-columns: repeat(5, minmax(220px, 1fr));
          gap: 14px; overflow-x: auto; padding-bottom: 8px; }
        .col { background: var(--color-bg); border: 1px solid var(--color-border);
          border-radius: 8px; padding: 14px 12px; min-height: 360px; }
        .col h4 { font-size: 13px; font-weight: 600; margin: 0 0 10px;
          display: flex; align-items: center; justify-content: space-between; }
        .col h4 .count { font-size: 11px; color: var(--color-muted);
          background: var(--color-card); padding: 2px 8px; border-radius: 999px; }
        .pulse { display: inline-block; width: 8px; height: 8px; border-radius: 50%;
          margin-right: 6px; vertical-align: middle; }
        .pulse.intake { background: var(--color-brand-supporting); }
        .pulse.field { background: var(--color-brand-blue); }
        .pulse.review { background: var(--color-brand-amber); }
        .pulse.opps { background: var(--color-brand-teal); }
        .pulse.delivery { background: #6cc06c; }
        .ticket { display: flex; gap: 10px; align-items: center; background: var(--color-card);
          border: 1px solid var(--color-border); border-radius: 8px; padding: 10px 12px;
          margin-bottom: 8px; text-decoration: none; color: inherit; }
        .ticket svg { flex-shrink: 0; }
        .ticket .t { font-size: 13px; font-weight: 500; line-height: 1.3; margin-bottom: 4px; }
        .ticket .meta { display: flex; justify-content: space-between; flex: 1;
          font-size: 11px; color: var(--color-muted); }
        .ticket .axis { background: var(--color-brand-teal); color: var(--color-brand-off-white);
          padding: 1px 6px; border-radius: 999px; text-transform: uppercase; font-size: 10px; }
        .empty { font-size: 12px; color: var(--color-muted); padding: 6px 0; }
        .footnote { margin-top: 24px; padding: 14px 16px; background: var(--color-card);
          border: 1px dashed var(--color-border); border-radius: 8px; font-size: 13px;
          color: var(--color-muted); }
        .btn-ghost { display: inline-block; padding: 8px 14px; border: 1px solid var(--color-border);
          border-radius: 6px; text-decoration: none; color: inherit; margin-right: 6px; }
        @media (max-width: 900px) { .kanban { grid-template-columns: 1fr 1fr; } }
      `}</style>
    </main>
  );
}
