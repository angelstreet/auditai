import { Logo } from '@/components/Logo';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { next?: string; error?: string };
}

const MESSAGES: Record<string, string> = {
  invalid: 'Email or password is incorrect.',
  'no-access': 'This account has no auditor access to any tenant.',
};

/** /login: auditor sign-in (ADR 0023). Plain EN copy until the i18n helper covers admin. */
export default function LoginPage({ searchParams }: PageProps) {
  const error = searchParams.error ? (MESSAGES[searchParams.error] ?? 'Sign-in failed.') : null;
  return (
    <main className="container">
      <Logo />
      <h1 style={{ marginTop: 'var(--space-4)' }}>Auditor sign-in</h1>
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
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
