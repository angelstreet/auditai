'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { AppIcon } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { clientIdle } from '@/lib/clientActionState';
import { createClientLinksAction } from './actions';

function Submit({ readOnly }: { readOnly: boolean }) {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  const button = (
    <Button
      type="submit"
      variant="contained"
      disabled={pending}
      aria-disabled={readOnly || undefined}
      startIcon={<AppIcon name="add" size={16} />}
      data-testid="client-create-links"
      sx={{ minHeight: 44 }}
    >
      {t('client.invitations.submit')}
    </Button>
  );
  // A disabled-looking primary always says why (UI_RULES §3). It still posts, and the server
  // refuses: the read-only rule is enforced there, not here.
  return readOnly ? <Tooltip title={t('client.invitations.readOnlyHint')}>{button}</Tooltip> : button;
}

/** "Create links" for the referent's team: one number, one primary action. */
export default function CreateLinksForm({
  readOnly,
  teams,
}: {
  readOnly: boolean;
  teams: readonly { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const [state, run] = useFormState(createClientLinksAction, clientIdle);
  const error =
    state.code === 'read_only'
      ? t('client.viewAs.readOnly')
      : state.code === 'bad_count' || state.code === 'no_survey' || state.code === 'failed'
        ? t(`client.invitations.errors.${state.code}`)
        : state.code === 'forbidden'
          ? t('client.forbidden')
          : null;
  return (
    <form action={run} data-testid="client-create-form">
      {teams.length > 1 ? null : <input type="hidden" name="teamId" value={teams[0]?.id ?? ''} />}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ alignItems: { sm: 'flex-start' } }}>
        {teams.length > 1 ? (
          <TextField
            select
            name="teamId"
            label={t('client.invitations.team')}
            defaultValue={teams[0]?.id}
            slotProps={{ select: { native: true } }}
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </TextField>
        ) : null}
        <TextField
          name="count"
          type="number"
          label={t('client.invitations.count')}
          helperText={readOnly ? t('client.invitations.readOnlyHint') : t('client.invitations.countHint')}
          defaultValue={5}
          slotProps={{ htmlInput: { min: 1, max: 500, inputMode: 'numeric' } }}
          sx={{ maxWidth: 220 }}
        />
        <Submit readOnly={readOnly} />
      </Stack>
      <div aria-live="polite">
        {state.ok ? (
          <Alert severity="success" sx={{ mt: 3 }} data-testid="client-create-done">
            {t('client.invitations.created', { count: state.count ?? 0 })}
          </Alert>
        ) : error ? (
          <Alert severity="warning" sx={{ mt: 3 }} data-testid="client-create-error">
            {error}
          </Alert>
        ) : null}
      </div>
    </form>
  );
}
