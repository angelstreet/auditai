import Button from '@mui/material/Button';
import { EmptyState, Mascot } from '@evolai/ui';
import { mascotTierOrder, mascotTierSchema } from '@evolai/contracts';
import { getT } from '@/lib/i18n';

export function generateMetadata() {
  return { title: getT().t('meta.pages.quizResult') };
}

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { tier?: string };
}

/** /quiz/result: the mascot reveal (M14). Public and tenant-free (ADR 0037): the tier comes from the URL. */
export default function QuizResult({ searchParams }: PageProps) {
  const { t } = getT();
  const requestedTier = mascotTierSchema.safeParse(searchParams.tier);
  const tier = requestedTier.success ? requestedTier.data : null;
  if (!tier) {
    return (
      <section className="stack">
        <h1>{t('quiz.resultTitle')}</h1>
        <EmptyState
          title={t('quiz.resultMissing')}
          action={
            <Button variant="contained" href="/quiz">
              {t('quiz.take')}
            </Button>
          }
        />
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
      <Button variant="text" href="/quiz" sx={{ alignSelf: 'flex-start' }}>
        {t('quiz.retake')}
      </Button>
    </section>
  );
}
