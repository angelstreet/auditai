import Link from 'next/link';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AuthCard from '@/components/auth/AuthCard';
import { peekToken } from '@/lib/authTokens';
import { getT } from '@/lib/i18n';
import SetPasswordForm from './SetPasswordForm';

export const dynamic = 'force-dynamic';
// The link carries a secret: never pass it on in a Referer header.
export const metadata = { referrer: 'no-referrer', robots: { index: false } } as const;

/** /set-password?token=…: first password of an invited person, or a reset (TASK-U, ADR 0039). */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const { t } = getT();
  const token = typeof searchParams.token === 'string' ? searchParams.token : '';
  const peek = token ? await peekToken(token) : null;
  if (!peek) {
    return (
      <AuthCard title={t('trust.setPassword.invalidTitle')}>
        <Typography sx={{ mb: 5 }}>{t('trust.setPassword.invalidBody')}</Typography>
        <Button component={Link} href="/forgot-password" variant="contained" size="large" fullWidth>
          {t('trust.setPassword.newLink')}
        </Button>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title={
        peek.kind === 'invite'
          ? t('trust.setPassword.titleInvite')
          : t('trust.setPassword.titleReset')
      }
      subtitle={t('trust.setPassword.lede')}
    >
      <SetPasswordForm token={token} />
    </AuthCard>
  );
}
