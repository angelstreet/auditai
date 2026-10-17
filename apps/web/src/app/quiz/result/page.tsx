import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Mascot } from '@auditai/ui';
import {
  mascotTierOrder,
  mascotTierSchema,
  type TenantId,
} from '@auditai/contracts';
import { listTenantIds, tenantLabel } from '@/lib/adminData';
import { getCurrentBadgeForPseudonym } from '@/lib/respondentBadgeData';
import { tierDescriptor } from '@auditai/domain';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { tenant?: string; pseudonym?: string; tier?: string };
}

/**
 * /quiz/result: the mascot reveal (M14).
 *
 * The page intentionally never surfaces the raw `quiz_score`. The
 * mascot tier comes from the URL (?tier=fox) AND is verified against
 * the freshly-written `respondent_badges` row so a tampered URL cannot
 * pretend to be a different mascot. The respondent sees a one-liner
 * tier descriptor; the team profile uses the same tier aggregated.
 */
export default async function QuizResult({ searchParams }: PageProps) {
  const tenants = await listTenantIds();
  const current = (tenants.find((t) => t === requestedTenant(searchParams.tenant)) ??
    tenants[0]) as TenantId | undefined;
  if (!current) {
    return (
      <main className="container">
        <Logo />
        <p>No tenants configured.</p>
      </main>
    );
  }
  const pseudonym = searchParams.pseudonym ?? '';
  const requestedTier = mascotTierSchema.safeParse(searchParams.tier);
  const label = await tenantLabel(current);
  const current_ = pseudonym ? await getCurrentBadgeForPseudonym(current, pseudonym) : null;
  // Always trust the row, falling back to the URL hint if the row is missing.
  const tier = current_?.mascotTier ?? (requestedTier.success ? requestedTier.data : null);
  if (!tier) {
    return (
      <main className="container">
        <Logo />
        <h1 style={{ marginTop: 'var(--space-4)' }}>Quiz result</h1>
        <p className="muted">
          We couldn't find a result for that pseudonym in tenant <strong>{label}</strong>.
        </p>
        <p>
          <Link className="btn-ghost" href={`/quiz?tenant=${current}`}>
            Take the quiz
          </Link>
        </p>
      </main>
    );
  }
  return (
    <main className="container">
      <Logo />
      <h1 style={{ marginTop: 'var(--space-4)' }}>Your mascot</h1>
      <p className="muted">
        Pseudonym <code>{pseudonym}</code> \u00b7 tenant <strong>{label}</strong>. Raw scores stay
        internal \u2014 the tier is what your team and your organisation see.
      </p>
      <section className={`reveal tier-${tier}`}>
        <Mascot tier={tier} size={160} />
        <div>
          <h2 className="tier-name">
            {tier === 'tortoise' ? 'Tortoise' : tier === 'fox' ? 'Fox' : 'Owl'}
          </h2>
          <p className="tier-desc">{tierDescriptor(tier)}</p>
        </div>
      </section>
      <p>
        <Link className="btn-ghost" href={`/quiz?tenant=${current}&pseudonym=${pseudonym}`}>
          Retake the quiz
        </Link>{' '}
        <Link className="btn-ghost" href="/about">
          About the framework
        </Link>
      </p>
      <aside className="all-tiers">
        <h3>The three tiers</h3>
        <ul>
          {mascotTierOrder.map((t) => (
            <li key={t} className={t === tier ? 'current' : ''}>
              <Mascot tier={t} size={48} />
              <span>
                <strong>{t === 'tortoise' ? 'Tortoise' : t === 'fox' ? 'Fox' : 'Owl'}</strong>
                <span className="muted"> &mdash; {tierDescriptor(t)}</span>
              </span>
            </li>
          ))}
        </ul>
      </aside>
      <style>{`
        .reveal { display: flex; align-items: center; gap: 28px; padding: 24px;
          background: var(--color-card); border: 1px solid var(--color-border);
          border-radius: 12px; max-width: 720px; }
        .reveal .tier-name { margin: 0; font-size: 28px; }
        .reveal .tier-desc { margin: 6px 0 0; color: var(--color-muted); font-size: 15px; }
        .all-tiers { margin-top: 24px; padding: 16px 18px; background: var(--color-card);
          border: 1px solid var(--color-border); border-radius: 8px; max-width: 720px; }
        .all-tiers h3 { margin: 0 0 10px; font-size: 14px; }
        .all-tiers ul { list-style: none; padding: 0; margin: 0; }
        .all-tiers li { display: flex; align-items: center; gap: 12px; padding: 6px 0;
          font-size: 13px; }
        .all-tiers li.current { background: var(--color-brand-supporting);
          color: var(--color-brand-off-white); padding: 6px 10px; border-radius: 6px; }
        .all-tiers li.current .muted { color: var(--color-brand-off-white); opacity: 0.85; }
        .btn-ghost { display: inline-block; padding: 8px 14px; border: 1px solid var(--color-border);
          border-radius: 6px; text-decoration: none; color: inherit; margin-right: 6px; }
      `}</style>
    </main>
  );
}

const requestedTenant = (raw: string | undefined): string | undefined => raw;
