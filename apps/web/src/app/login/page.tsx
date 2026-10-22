import Link from 'next/link';
import Typography from '@mui/material/Typography';
import AuthCard from '@/components/auth/AuthCard';
import LoginForm from '@/components/auth/LoginForm';
import { getT } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { next?: string; error?: string };
}

const MESSAGE_KEYS = { invalid: 'login.invalid', locked: 'login.locked' } as const;

/**
 * /login: sign-in (ADR 0023), localised FR/EN (ADR 0024), standard card (ADR 0034). No logo in
 * the card (the header has it), no help text; the one line under it is for people who landed
 * here instead of opening their survey link.
 */
export default function LoginPage({ searchParams }: PageProps) {
  const { t } = getT();
  const errorKey = searchParams.error
    ? (MESSAGE_KEYS[searchParams.error as keyof typeof MESSAGE_KEYS] ?? 'login.failed')
    : null;
  return (
    <AuthCard
      title={t('login.title')}
      footer={
        <Typography
          variant="body2"
          color="text.secondary"
          data-testid="survey-line"
          sx={{ mt: 6, mb: 0, maxWidth: 400 }}
        >
          {t('welcome.surveyLine')}
        </Typography>
      }
    >
      <LoginForm
        next={searchParams.next ?? ''}
        error={errorKey ? t(errorKey) : null}
        labels={{
          email: t('login.email'),
          password: t('login.password'),
          submit: t('login.submit'),
          show: t('login.showPassword'),
          hide: t('login.hidePassword'),
          signingIn: t('login.signingIn'),
        }}
      />
      <Typography variant="body2" sx={{ mt: 5, mb: 0 }}>
        <Link href="/forgot-password">{t('login.forgot')}</Link>
      </Typography>
    </AuthCard>
  );
}
