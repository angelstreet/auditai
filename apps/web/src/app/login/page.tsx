import Link from 'next/link';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LoginForm from '@/components/auth/LoginForm';
import { Logo } from '@/components/Logo';
import { getT } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { next?: string; error?: string };
}

const MESSAGE_KEYS = { invalid: 'login.invalid', locked: 'login.locked' } as const;

/** /login: auditor sign-in (ADR 0023), localised FR/EN (ADR 0024), standard card (ADR 0033). */
export default function LoginPage({ searchParams }: PageProps) {
  const { t } = getT();
  const errorKey = searchParams.error
    ? (MESSAGE_KEYS[searchParams.error as keyof typeof MESSAGE_KEYS] ?? 'login.failed')
    : null;
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', py: { xs: 4, sm: 12 } }}>
      <Paper
        variant="outlined"
        sx={{ width: '100%', maxWidth: 400, p: { xs: 6, sm: 8 }, borderRadius: 4 }}
      >
        <Box sx={{ mb: 6 }}>
          <Logo iconOnly />
          <Typography variant="pageTitle" component="h1" sx={{ mt: 4, mb: 1 }}>
            {t('login.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ m: 0 }}>
            {t('login.subtitle')}
          </Typography>
        </Box>
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
      </Paper>
      <Typography variant="body2" sx={{ mt: 5 }}>
        <Link href="/privacy">{t('common.nav.privacy')}</Link>
      </Typography>
    </Box>
  );
}
