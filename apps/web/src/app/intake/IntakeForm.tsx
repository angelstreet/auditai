'use client';

import { useState, type ReactNode } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AppIcon, StatusText } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { saveSponsorBriefAction, type IntakeActionState } from './actions';

const INITIAL: IntakeActionState = { ok: false, message: '' };

function SubmitButton() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" disabled={pending} sx={{ minWidth: 180 }}>
      {pending ? t('intake.saving') : t('intake.save')}
    </Button>
  );
}

/**
 * Multi-select as toggle chips (UI_RULES §0, §3): pressed = accent edge and a check icon, unpressed =
 * a plus icon, so the chip keeps its size when toggled. Hidden inputs carry the values to the form.
 */
function ToggleChips({
  name,
  label,
  options,
  initial,
}: {
  name: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  initial: ReadonlyArray<string>;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(initial));
  const toggle = (value: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  return (
    <FormControl component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
      <FormLabel component="legend" sx={{ mb: 2 }}>
        {label}
      </FormLabel>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
        {options.map((o) => {
          const on = selected.has(o.value);
          return (
            <Chip
              key={o.value}
              label={o.label}
              clickable
              variant="outlined"
              color={on ? 'primary' : 'default'}
              aria-pressed={on}
              onClick={() => toggle(o.value)}
              icon={<AppIcon name={on ? 'success' : 'add'} size={16} />}
              sx={{ minHeight: 44, borderRadius: 999 }}
            />
          );
        })}
      </Stack>
      {[...selected].map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
    </FormControl>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 4, sm: 6 }, borderRadius: 3 }}>
      <Typography variant="sectionTitle" component="h2" sx={{ m: 0 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 5 }}>
        {desc}
      </Typography>
      <Stack sx={{ gap: 5 }}>{children}</Stack>
    </Paper>
  );
}

export function IntakeForm() {
  const { t } = useI18n();
  const [state, formAction] = useFormState(saveSponsorBriefAction, INITIAL);
  const opts = (group: string, values: readonly string[]) =>
    values.map((value) => ({ value, label: t(`intake.${group}.${value}` as never) }));
  return (
    <Stack component="form" action={formAction} sx={{ gap: 4, minWidth: 0 }}>
      <Section title={t('intake.s1Title')} desc={t('intake.s1Desc')}>
        <TextField
          id="topPriorityWorkflow"
          name="topPriorityWorkflow"
          label={t('intake.topPriorityLabel')}
          placeholder={t('intake.topPriorityPlaceholder')}
          fullWidth
        />
        <ToggleChips
          name="departmentsInScope"
          label={t('intake.departmentsLabel')}
          options={opts('dept', [
            'operations',
            'sales',
            'finance',
            'legal',
            'engineering',
            'people',
          ])}
          initial={['operations', 'sales']}
        />
        <ToggleChips
          name="dataSensitivityBoundary"
          label={t('intake.sensitivityLabel')}
          options={opts('sens', ['internal_only', 'public_web', 'customer_pii', 'regulated'])}
          initial={['internal_only']}
        />
      </Section>

      <Section title={t('intake.s2Title')} desc={t('intake.s2Desc')}>
        <TextField
          id="annualBudgetEur"
          name="annualBudgetEur"
          label={t('intake.budgetLabel')}
          placeholder={t('intake.budgetPlaceholder')}
          inputProps={{ inputMode: 'numeric' }}
          sx={{ maxWidth: 360 }}
        />
        <TextField
          select
          id="onsiteAppetite"
          name="onsiteAppetite"
          label={t('intake.onsiteLabel')}
          defaultValue="limited_team"
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ maxWidth: 360 }}
        >
          <MenuItem value="">{t('common.dash')}</MenuItem>
          {opts('onsiteOpt', ['full_pilot', 'limited_team', 'remote_only']).map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      </Section>

      <Section title={t('intake.s3Title')} desc={t('intake.s3Desc')}>
        <ToggleChips
          name="approvedModelRegions"
          label={t('intake.regionsLabel')}
          options={opts('region', ['eu_only', 'us_enterprise', 'self_hosted', 'no_constraint'])}
          initial={['eu_only']}
        />
        <ToggleChips
          name="dataResidency"
          label={t('intake.residencyLabel')}
          options={opts('res', ['eu_frankfurt', 'us', 'client_vpc'])}
          initial={['eu_frankfurt']}
        />
        <TextField
          select
          id="promptInjectionReview"
          name="promptInjectionReview"
          label={t('intake.injectionLabel')}
          defaultValue="external_auditor"
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ maxWidth: 480 }}
        >
          <MenuItem value="">{t('common.dash')}</MenuItem>
          {opts('injection', ['external_auditor', 'internal', 'none_yet']).map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      </Section>

      <Section title={t('intake.s4Title')} desc={t('intake.s4Desc')}>
        {(['leadershipLiteracy', 'operationalAdoption', 'policyGovernance'] as const).map((k) => (
          <Box key={k} sx={{ maxWidth: 480 }}>
            <Typography id={`${k}-label`} variant="body2" component="p" sx={{ m: 0 }}>
              {t(`intake.${k}`)}
            </Typography>
            <Slider
              name={k}
              min={0}
              max={5}
              step={1}
              marks
              defaultValue={2}
              valueLabelDisplay="auto"
              aria-labelledby={`${k}-label`}
            />
          </Box>
        ))}
      </Section>

      {/* At least 24 px between the last card and the button (UI_RULES §13). */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ mt: 2, gap: 3, alignItems: { sm: 'center' } }}
      >
        <SubmitButton />
        <Box aria-live="polite" sx={{ minHeight: 24 }}>
          {state.message ? (
            <StatusText status={state.ok ? 'success' : 'error'}>{state.message}</StatusText>
          ) : null}
        </Box>
      </Stack>
    </Stack>
  );
}
