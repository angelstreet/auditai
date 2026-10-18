import { listTenantIds } from '@/lib/adminData';
import { LITERACY_QUIZ } from '@evolai/domain';
import { QuizForm } from './QuizForm';
import { submitQuizAction } from './actions';
import { getT } from '@/lib/i18n';
import type { TenantId } from '@evolai/contracts';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { tenant?: string; pseudonym?: string };
}

/**
 * /quiz: the public respondent-facing literacy quiz (M14).
 *
 * No login (matches the M5 mobile-survey pattern). A fresh pseudonym is
 * minted server-side when the user lands without one. The form posts to
 * `submitQuizAction`, which writes one row to `respondent_badges`,
 * demotes the previous current row for the same pseudonym, computes
 * the mascot tier via `mascotTierForScore`, and redirects to the
 * result page with the tier in the query string.
 */
export function generateMetadata() {
  return { title: getT().t('meta.pages.quiz') };
}

export default async function QuizLanding({ searchParams }: PageProps) {
  const { t } = getT();
  const tenants = await listTenantIds();
  const requested = searchParams.tenant;
  const current = (tenants.find((t) => t === requested) ?? tenants[0]) as TenantId | undefined;
  if (!current) {
    return (
      <section className="stack">
        <h1>{t('quiz.title')}</h1>
        <p>{t('quiz.noTenants')}</p>
      </section>
    );
  }
  const pseudonym =
    searchParams.pseudonym ??
    `quiz-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`;
  return (
    <div className="stack">
      <p className="muted">
        {t('quiz.intro')} {t('quiz.privacyShort')}
      </p>
      <QuizForm
        action={submitQuizAction}
        tenantId={current}
        pseudonym={pseudonym}
        questions={LITERACY_QUIZ}
      />
    </div>
  );
}
