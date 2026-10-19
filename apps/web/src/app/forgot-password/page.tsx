import Link from 'next/link';
import Typography from '@mui/material/Typography';
import AuthCard from '@/components/auth/AuthCard';
import { getT } from '@/lib/i18n';
import ForgotForm from './ForgotForm';

export const dynamic = 'force-dynamic';

/** /forgot-password: ask for a reset link by email (TASK-U, ADR 0039). Same answer for every address. */
export default function ForgotPasswordPage() {
  const { t } = getT();
  return (
    <AuthCard title={t('trust.forgot.title')} subtitle={t('trust.forgot.lede')}>
      <ForgotForm />
      <Typography variant="body2" sx={{ mt: 5 }}>
        <Link href="/login">{t('trust.forgot.back')}</Link>
      </Typography>
    </AuthCard>
  );
}
