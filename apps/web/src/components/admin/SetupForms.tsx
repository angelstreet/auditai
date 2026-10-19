'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormLabel from '@mui/material/FormLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AppIcon, ConfirmDialog, StatusText } from '@evolai/ui';
import type { MessageKey } from '@evolai/i18n';
import { useI18n } from '@/components/I18nProvider';
import {
  changeStatusAction,
  createEngagementAction,
  createTeamAction,
  updateEngagementAction,
  updateTeamAction,
} from '@/app/admin/engagements/actions';
import { setupIdle, type SetupActionState } from '@/app/admin/engagements/state';

/** One line of feedback for a set-up action: icon plus plain words, announced politely. */
export function SetupResult({ state }: { state: SetupActionState }) {
  const { t } = useI18n();
  return (
    <Box aria-live="polite" sx={{ minHeight: 24 }}>
      {state.code !== 'idle' ? (
        <StatusText status={state.ok ? 'success' : 'error'}>
          {t(`admin.setup.result.${state.code}` as MessageKey)}
        </StatusText>
      ) : null}
    </Box>
  );
}

// Memoised so a re-render never rewrites the hidden tenant field (see e2e/auth.spec.ts).
const TenantField = memo(function TenantField({ tenantId }: { tenantId: string }) {
  return <input type="hidden" name="tenantId" value={tenantId} />;
});

function Submit({ label, icon }: { label: string; icon?: 'add' }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="contained"
      disabled={pending}
      startIcon={icon ? <AppIcon name={icon} size={20} /> : undefined}
      sx={{ alignSelf: 'flex-start', minWidth: 160 }}
    >
      {label}
    </Button>
  );
}

export interface TeamChoice {
  readonly id: string;
  readonly name: string;
  readonly size: number;
}

export interface EngagementFormValues {
  readonly engagementId?: string;
  readonly name: string;
  readonly locale: 'fr' | 'en';
  readonly opensOn: string;
  readonly closesOn: string;
  readonly teamIds: readonly string[];
  readonly locked?: boolean;
}

/** Create or edit an engagement: name, language, dates, teams. Headcount follows the team sizes. */
export function EngagementForm({
  tenantId,
  teams,
  values,
  teamsHref,
}: {
  tenantId: string;
  teams: readonly TeamChoice[];
  values: EngagementFormValues;
  teamsHref: string;
}) {
  const { t, locale } = useI18n();
  const editing = Boolean(values.engagementId);
  const [state, action] = useFormState(
    editing ? updateEngagementAction : createEngagementAction,
    setupIdle,
  );
  const [picked, setPicked] = useState<readonly string[]>(values.teamIds);
  const headcount = teams.filter((x) => picked.includes(x.id)).reduce((n, x) => n + x.size, 0);
  return (
    <Stack component="form" action={action} sx={{ gap: 4, maxWidth: 640 }}>
      <TenantField tenantId={tenantId} />
      {values.engagementId ? (
        <input type="hidden" name="engagementId" value={values.engagementId} />
      ) : null}
      <TextField
        name="name"
        label={t('admin.setup.form.name')}
        helperText={t('admin.setup.form.nameHelp')}
        defaultValue={values.name}
        required
        slotProps={{ htmlInput: { maxLength: 120 } }}
      />
      <TextField
        select
        name="locale"
        label={t('admin.setup.form.locale')}
        defaultValue={values.locale}
        required
      >
        <MenuItem value="fr" lang="fr">
          {t('common.language.fr')}
        </MenuItem>
        <MenuItem value="en" lang="en">
          {t('common.language.en')}
        </MenuItem>
      </TextField>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 3 }}>
        <TextField
          type="date"
          name="opensOn"
          label={t('admin.setup.form.opensOn')}
          defaultValue={values.opensOn}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ flex: 1 }}
        />
        <TextField
          type="date"
          name="closesOn"
          label={t('admin.setup.form.closesOn')}
          defaultValue={values.closesOn}
          helperText={t('admin.setup.form.datesHelp')}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ flex: 1 }}
        />
      </Stack>
      <FormGroup>
        <FormLabel component="legend" sx={{ mb: 1 }}>
          {t('admin.setup.form.teams')}
        </FormLabel>
        {teams.length === 0 ? (
          <Typography color="text.secondary">
            {t('admin.setup.form.noTeams')} <a href={teamsHref}>{t('admin.setup.form.addTeams')}</a>
          </Typography>
        ) : (
          teams.map((team) => (
            <FormControlLabel
              key={team.id}
              control={
                <Checkbox
                  name="teamId"
                  value={team.id}
                  checked={picked.includes(team.id)}
                  onChange={(e) =>
                    setPicked((cur) =>
                      e.target.checked ? [...cur, team.id] : cur.filter((id) => id !== team.id),
                    )
                  }
                />
              }
              label={`${team.name} (${t('admin.setup.teams.sizeShort', { n: team.size })})`}
              sx={{ minHeight: 44 }}
            />
          ))
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }} data-locale={locale}>
          {t('admin.setup.form.headcount', { n: headcount })}
        </Typography>
      </FormGroup>
      <SetupResult state={state} />
      {values.locked ? null : (
        <Submit label={editing ? t('admin.setup.form.save') : t('admin.setup.form.create')} />
      )}
    </Stack>
  );
}

/** Status section: the launch and close buttons, each behind a plain confirmation. */
export function StatusPanel({
  tenantId,
  engagementId,
  status,
  hasTeams,
}: {
  tenantId: string;
  engagementId: string;
  status: string;
  hasTeams: boolean;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(changeStatusAction, setupIdle);
  const formRef = useRef<HTMLFormElement>(null);
  const [asking, setAsking] = useState<'launch' | 'close' | null>(null);
  const canLaunch = status === 'draft' || status === 'scheduled';
  const canClose = status === 'in_field';
  const submit = (change: 'launch' | 'close') => {
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem('change') as HTMLInputElement).value = change;
    (form.elements.namedItem('confirm') as HTMLInputElement).value = 'yes';
    form.requestSubmit();
  };
  return (
    <Stack component="form" ref={formRef} action={action} sx={{ gap: 3 }}>
      <TenantField tenantId={tenantId} />
      <input type="hidden" name="engagementId" value={engagementId} />
      <input type="hidden" name="change" value="" />
      <input type="hidden" name="confirm" value="" />
      <Typography>{t(`admin.setup.status.${status}` as MessageKey)}</Typography>
      {canLaunch ? (
        <Box>
          <Button
            variant="contained"
            disabled={!hasTeams}
            onClick={() => setAsking('launch')}
            startIcon={<AppIcon name="act" size={20} />}
          >
            {t('admin.setup.status.launch')}
          </Button>
          {hasTeams ? null : (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              {t('admin.setup.status.needTeams')}
            </Typography>
          )}
        </Box>
      ) : null}
      {canClose ? (
        <Box>
          <Button variant="outlined" color="error" onClick={() => setAsking('close')}>
            {t('admin.setup.status.close')}
          </Button>
        </Box>
      ) : null}
      <SetupResult state={state} />
      <ConfirmDialog
        open={asking !== null}
        danger={asking === 'close'}
        title={
          asking === 'close'
            ? t('admin.setup.status.closeTitle')
            : t('admin.setup.status.launchTitle')
        }
        body={
          asking === 'close'
            ? t('admin.setup.status.closeBody')
            : t('admin.setup.status.launchBody')
        }
        confirmLabel={
          asking === 'close'
            ? t('admin.setup.status.closeConfirm')
            : t('admin.setup.status.launchConfirm')
        }
        cancelLabel={t('admin.setup.status.cancel')}
        onClose={() => setAsking(null)}
        onConfirm={() => {
          const change = asking;
          setAsking(null);
          if (change) submit(change);
        }}
      />
    </Stack>
  );
}

/** Add a team: name and size. */
export function AddTeamForm({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const [state, action] = useFormState(createTeamAction, setupIdle);
  const formRef = useRef<HTMLFormElement>(null);
  // Empty the fields once the server accepted the team.
  useEffect(() => {
    if (state.ok && state.code === 'team_created') formRef.current?.reset();
  }, [state]);
  return (
    <Stack component="form" ref={formRef} action={action} sx={{ gap: 3 }}>
      <TenantField tenantId={tenantId} />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ gap: 3, alignItems: { sm: 'flex-start' } }}
      >
        <TextField
          name="name"
          label={t('admin.setup.teams.name')}
          required
          slotProps={{ htmlInput: { maxLength: 120 } }}
          sx={{ flex: 2 }}
        />
        <TextField
          name="expectedHeadcount"
          type="number"
          label={t('admin.setup.teams.size')}
          required
          defaultValue={5}
          slotProps={{ htmlInput: { min: 0, max: 10000, inputMode: 'numeric' } }}
          sx={{ flex: 1, minWidth: 160 }}
        />
        <Submit label={t('admin.setup.teams.add')} icon="add" />
      </Stack>
      <SetupResult state={state} />
    </Stack>
  );
}

/** One team row: rename and resize in place. */
export function TeamRow({
  tenantId,
  team,
  usedLabel,
}: {
  tenantId: string;
  team: TeamChoice;
  usedLabel: string;
}) {
  const { t } = useI18n();
  const [state, action] = useFormState(updateTeamAction, setupIdle);
  return (
    <Box component="li" sx={{ py: 3, borderBottom: 1, borderColor: 'divider', listStyle: 'none' }}>
      <Stack component="form" action={action} sx={{ gap: 2 }}>
        <TenantField tenantId={tenantId} />
        <input type="hidden" name="teamId" value={team.id} />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ gap: 2, alignItems: { sm: 'center' } }}
        >
          <TextField
            name="name"
            defaultValue={team.name}
            size="small"
            required
            slotProps={{
              htmlInput: {
                maxLength: 120,
                'aria-label': t('admin.setup.teams.editAria', { team: team.name }),
              },
            }}
            sx={{ flex: 2 }}
          />
          <TextField
            name="expectedHeadcount"
            type="number"
            defaultValue={team.size}
            size="small"
            required
            slotProps={{
              htmlInput: { min: 0, max: 10000, 'aria-label': t('admin.setup.teams.size') },
            }}
            sx={{ flex: 1, minWidth: 120 }}
          />
          <Button type="submit" variant="outlined" sx={{ minWidth: 120 }}>
            {t('admin.setup.teams.rename')}
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {usedLabel}
        </Typography>
        <SetupResult state={state} />
      </Stack>
    </Box>
  );
}
