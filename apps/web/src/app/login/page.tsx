import { Logo } from '@/components/Logo';
import { getT } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { next?: string; error?: string };
}

const MESSAGE_KEYS = { invalid: 'login.invalid', 'no-access': 'login.noAccess' } as const;

/** /login: auditor sign-in (ADR 0023), localised FR/EN (ADR 0024). */
export default function LoginPage({ searchParams }: PageProps) {
  const { t } = getT();
  const errorKey = searchParams.error
    ? (MESSAGE_KEYS[searchParams.error as keyof typeof MESSAGE_KEYS] ?? 'login.failed')
    : null;
  const error = errorKey ? t(errorKey) : null;
  return (
    <main className="container">
      <Logo />
      <h1 style={{ marginTop: 'var(--space-4)' }}>{t('login.title')}</h1>
      {error ? (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      ) : null}
      <form
        method="post"
        action="/api/auth/login"
        style={{ display: 'grid', gap: 12, maxWidth: 360 }}
      >
        <input type="hidden" name="next" value={searchParams.next ?? ''} />
        <label>
          {t('login.email')}
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          {t('login.password')}
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit">{t('login.submit')}</button>
      </form>
    </main>
  );
}
