'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { AppIcon } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { forgotPasswordAction, type ForgotState } from './actions';

const INITIAL: ForgotState = { ok: false, message: '' };

function Submit() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="contained"
      size="large"
      fullWidth
      loading={pending}
      loadingPosition="start"
      startIcon={<AppIcon name="invite" />}
    >
      {pending ? t('trust.forgot.sending') : t('trust.forgot.submit')}
    </Button>
  );
}

export default function ForgotForm() {
  const { t } = useI18n();
  const [state, action] = useFormState(forgotPasswordAction, INITIAL);
  return (
    <Stack component="form" action={action} spacing={5}>
      {state.message ? (
        <Alert
          severity={state.ok ? 'success' : 'error'}
          role={state.ok ? 'status' : 'alert'}
          icon={<AppIcon name={state.ok ? 'success' : 'error'} />}
        >
          {state.message}
        </Alert>
      ) : null}
      <TextField
        name="email"
        type="email"
        label={t('trust.forgot.email')}
        autoComplete="username"
        required
        fullWidth
        autoFocus
        error={Boolean(state.message) && !state.ok}
      />
      <Submit />
    </Stack>
  );
}
