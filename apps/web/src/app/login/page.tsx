import { getT } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { next?: string; error?: string };
}

const MESSAGE_KEYS = { invalid: 'login.invalid', locked: 'login.locked' } as const;

/** /login: auditor sign-in (ADR 0023), localised FR/EN (ADR 0024). */
export default function LoginPage({ searchParams }: PageProps) {
  const { t } = getT();
  const errorKey = searchParams.error
    ? (MESSAGE_KEYS[searchParams.error as keyof typeof MESSAGE_KEYS] ?? 'login.failed')
    : null;
  const error = errorKey ? t(errorKey) : null;
  return (
    <div className="stack">
      <h1>{t('login.title')}</h1>
      {error ? (
        <p role="alert" className="alert">
          {error}
        </p>
      ) : null}
      <form method="post" action="/api/auth/login" className="stack">
        <input type="hidden" name="next" value={searchParams.next ?? ''} />
        <label className="field">
          {t('login.email')}
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label className="field">
          {t('login.password')}
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit" className="btn btn-primary">
          {t('login.submit')}
        </button>
      </form>
    </div>
  );
}
