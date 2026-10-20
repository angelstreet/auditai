'use client';

import { memo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { AppIcon, StatusText } from '@evolai/ui';
import { copyText } from '@/lib/clipboard';
import { useI18n } from '@/components/I18nProvider';
import { inviteReferentAction, type InviteState } from './actions';

const INITIAL: InviteState = { ok: false, message: '' };

const Hidden = memo(function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
});

function Submit() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="contained"
      disabled={pending}
      startIcon={<AppIcon name="invite" size={20} />}
      sx={{ alignSelf: { sm: 'flex-start' } }}
    >
      {pending ? t('trust.referents.creating') : t('trust.referents.create')}
    </Button>
  );
}

/** One referent: optional new address, one primary button, then the link to copy and send. */
export default function ReferentInviteForm({
  tenantId,
  userId,
}: {
  tenantId: string;
  userId: string;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(inviteReferentAction, INITIAL);
  const [copied, setCopied] = useState(false);
  return (
    <Stack component="form" action={action} sx={{ gap: 3 }}>
      <Hidden name="tenantId" value={tenantId} />
      <Hidden name="userId" value={userId} />
      <TextField
        name="email"
        type="email"
        label={t('trust.referents.email')}
        helperText={t('trust.referents.emailHelp')}
        autoComplete="off"
        inputProps={{ spellCheck: false }}
        sx={{ maxWidth: 420 }}
      />
      <Submit />
      <div aria-live="polite">
        {state.message ? (
          <StatusText status={state.ok ? 'success' : 'error'}>{state.message}</StatusText>
        ) : null}
        {state.ok && state.emailed ? (
          <StatusText status="success">{t('trust.referents.emailedTo')}</StatusText>
        ) : null}
      </div>
      {state.link ? (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ gap: 2, alignItems: { sm: 'center' } }}
        >
          <TextField
            label={t('trust.referents.linkLabel')}
            value={state.link}
            inputProps={{ readOnly: true, 'data-testid': 'invite-link' }}
            onFocus={(e) => e.target.select()}
            sx={{ flex: 1, maxWidth: 560 }}
          />
          <Button
            variant="outlined"
            startIcon={<AppIcon name="copy" size={20} />}
            onClick={async () => {
              // The full link stays in the selectable field above if the copy is refused.
              setCopied(await copyText(state.link ?? ''));
            }}
          >
            {copied ? t('trust.referents.copied') : t('trust.referents.copy')}
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}
