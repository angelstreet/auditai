import { Logo } from '@/components/Logo';
import { listTenantIds, tenantLabel } from '@/lib/adminData';
import { LITERACY_QUIZ } from '@auditai/domain';
import { QuizForm } from './QuizForm';
import { getT } from '@/lib/i18n';
import type { TenantId } from '@auditai/contracts';

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
      <main className="container">
        <Logo />
        <p>{t('common.noTenants', { command: 'pnpm local:reset' })}</p>
      </main>
    );
  }
  const pseudonym =
    searchParams.pseudonym ??
    `quiz-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`;
  const label = await tenantLabel(current);
  return (
    <main className="container">
      <Logo />
      <h1 style={{ marginTop: 'var(--space-4)' }}>{t('quiz.title')}</h1>
      <p className="muted">{t('quiz.intro', { label })}</p>
      <p className="muted">
        <strong>{t('quiz.pseudonym')}</strong> <code>{pseudonym}</code>
      </p>
      <QuizForm tenantId={current} pseudonym={pseudonym} questions={LITERACY_QUIZ} />
    </main>
  );
}
