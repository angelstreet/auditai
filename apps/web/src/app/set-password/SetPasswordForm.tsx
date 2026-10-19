'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { AppIcon } from '@evolai/ui';
import PasswordField from '@/components/auth/PasswordField';
import { useI18n } from '@/components/I18nProvider';
import { MIN_PASSWORD_LENGTH } from '@/lib/passwordPolicy';
import { setPasswordAction, type SetPasswordState } from './actions';

const INITIAL: SetPasswordState = { message: '' };

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
      startIcon={<AppIcon name="signIn" />}
    >
      {pending ? t('trust.setPassword.saving') : t('trust.setPassword.submit')}
    </Button>
  );
}

/** Choose a password: one rule shown up front (12+ characters), a show/hide eye, one primary button. */
export default function SetPasswordForm({ token }: { token: string }) {
  const { t } = useI18n();
  const [state, action] = useFormState(setPasswordAction, INITIAL);
  const show = t('trust.setPassword.show');
  const hide = t('trust.setPassword.hide');
  return (
    <Stack component="form" action={action} spacing={5}>
      <input type="hidden" name="token" value={token} />
      {state.message ? (
        <Alert severity="error" role="alert" icon={<AppIcon name="error" />}>
          {state.message}
        </Alert>
      ) : null}
      <PasswordField
        name="password"
        label={t('trust.setPassword.password')}
        helperText={t('trust.setPassword.rule')}
        autoComplete="new-password"
        required
        autoFocus
        show={show}
        hide={hide}
        slotProps={undefined}
        inputProps={{ minLength: MIN_PASSWORD_LENGTH, maxLength: 256 }}
      />
      <PasswordField
        name="again"
        label={t('trust.setPassword.again')}
        autoComplete="new-password"
        required
        show={show}
        hide={hide}
        inputProps={{ minLength: MIN_PASSWORD_LENGTH, maxLength: 256 }}
      />
      <Submit />
    </Stack>
  );
}
