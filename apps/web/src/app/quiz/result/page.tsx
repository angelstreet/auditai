import Link from 'next/link';
import { Mascot } from '@evolai/ui';
import { mascotTierOrder, mascotTierSchema, type TenantId } from '@evolai/contracts';
import { listTenantIds } from '@/lib/adminData';
import { getCurrentBadgeForPseudonym } from '@/lib/respondentBadgeData';
import { getT } from '@/lib/i18n';

export function generateMetadata() {
  return { title: getT().t('meta.pages.quizResult') };
}

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
  const { t } = getT();
  const tenants = await listTenantIds();
  const current = (tenants.find((t) => t === searchParams.tenant) ?? tenants[0]) as
    | TenantId
    | undefined;
  const pseudonym = searchParams.pseudonym ?? '';
  const requestedTier = mascotTierSchema.safeParse(searchParams.tier);
  const badge = current && pseudonym ? await getCurrentBadgeForPseudonym(current, pseudonym) : null;
  // Always trust the row, falling back to the URL hint if the row is missing.
  const tier = badge?.mascotTier ?? (requestedTier.success ? requestedTier.data : null);
  if (!tier) {
    return (
      <section className="stack">
        <h1>{t('quiz.resultTitle')}</h1>
        <p>{t('quiz.resultMissing')}</p>
        <Link className="btn btn-primary" href="/quiz">
          {t('quiz.take')}
        </Link>
      </section>
    );
  }
  return (
    <section className="stack">
      <h1>{t('quiz.mascotTitle')}</h1>
      <div className={`card reveal tier-${tier}`}>
        <Mascot tier={tier} size={120} label={t(`quiz.mascotAlt.${tier}`)} />
        <div>
          <h2 className="tier-name">{t(`quiz.tier.${tier}`)}</h2>
          <p>{t(`quiz.tierDescriptor.${tier}`)}</p>
        </div>
      </div>
      <p className="muted">{t('quiz.mascotIntro')}</p>
      <details>
        <summary>{t('quiz.threeTiers')}</summary>
        <ul className="tier-list">
          {mascotTierOrder.map((tierKey) => (
            <li key={tierKey} aria-current={tierKey === tier ? 'true' : undefined}>
              <Mascot tier={tierKey} size={40} label={t(`quiz.mascotAlt.${tierKey}`)} />
              <span>
                <strong>{t(`quiz.tier.${tierKey}`)}</strong> — {t(`quiz.tierDescriptor.${tierKey}`)}
              </span>
            </li>
          ))}
        </ul>
      </details>
      <Link className="btn btn-secondary" href={`/quiz?pseudonym=${encodeURIComponent(pseudonym)}`}>
        {t('quiz.retake')}
      </Link>
    </section>
  );
}
