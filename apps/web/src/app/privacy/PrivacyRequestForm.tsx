'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { AppIcon } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { submitPrivacyRequestAction, type RequestState } from './actions';

const INITIAL: RequestState = { ok: false, message: '' };

function Submit() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="contained"
      disabled={pending}
      startIcon={<AppIcon name="invite" size={20} />}
      sx={{ alignSelf: 'flex-start' }}
    >
      {pending ? t('trust.notice.sending') : t('trust.notice.send')}
    </Button>
  );
}

/** Plain request form: no sign-in, no name. It reaches the auditor, not a manager. */
export default function PrivacyRequestForm({ engagementId }: { engagementId: string }) {
  const { t } = useI18n();
  const [state, action] = useFormState(submitPrivacyRequestAction, INITIAL);
  if (state.ok) {
    return (
      <Alert severity="success" role="status" icon={<AppIcon name="success" />}>
        {state.message}
      </Alert>
    );
  }
  return (
    <Stack component="form" action={action} sx={{ gap: 4, maxWidth: 520 }}>
      <input type="hidden" name="engagementId" value={engagementId} />
      {state.message ? (
        <Alert severity="error" role="alert" icon={<AppIcon name="error" />}>
          {state.message}
        </Alert>
      ) : null}
      <TextField select name="kind" label={t('trust.notice.kind')} defaultValue="erase" required>
        <MenuItem value="erase">{t('trust.notice.kindErase')}</MenuItem>
        <MenuItem value="withdraw">{t('trust.notice.kindWithdraw')}</MenuItem>
        <MenuItem value="question">{t('trust.notice.kindQuestion')}</MenuItem>
      </TextField>
      <TextField
        name="code"
        label={t('trust.notice.code')}
        helperText={t('trust.notice.codeHelp')}
        autoComplete="off"
        inputProps={{ maxLength: 64, spellCheck: false }}
      />
      <TextField
        name="message"
        label={t('trust.notice.message')}
        multiline
        minRows={3}
        inputProps={{ maxLength: 1000 }}
      />
      <TextField
        name="replyTo"
        type="email"
        label={t('trust.notice.replyTo')}
        helperText={t('trust.notice.replyHelp')}
        autoComplete="off"
      />
      <Submit />
    </Stack>
  );
}
