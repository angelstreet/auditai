import { LITERACY_QUIZ } from '@evolai/domain';
import { QuizForm } from './QuizForm';
import { submitQuizAction } from './actions';
import { getT } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * /quiz: the public demo of the literacy quiz (M14, ADR 0036). No login and no tenant: nothing is
 * stored. The score becomes a mascot tier in the URL of the result page. The stored quiz lives at
 * `/s/[token]/quiz`, where the invitation fixes tenant and pseudonym.
 */
export function generateMetadata() {
  return { title: getT().t('meta.pages.quiz') };
}

export default function QuizLanding() {
  const { t } = getT();
  return (
    <div className="stack">
      <p className="muted">
        {t('quiz.intro')} {t('quiz.privacyShort')}
      </p>
      <QuizForm action={submitQuizAction} questions={LITERACY_QUIZ} />
    </div>
  );
}
