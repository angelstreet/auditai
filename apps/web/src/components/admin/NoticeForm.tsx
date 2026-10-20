'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AppIcon, StatusText } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { saveNoticeAction, type NoticeState } from '@/app/admin/engagements/[id]/settings/actions';
import type { NoticeGap, NoticeInput } from '@/lib/privacyNotice';

const INITIAL: NoticeState = { ok: false, message: '' };

const GAP_KEY = {
  contact: 'trust.noticeForm.warnContact',
  providers: 'trust.noticeForm.warnProviders',
  retention: 'trust.noticeForm.warnRetention',
  ai: 'trust.noticeForm.warnAi',
} as const;

function Save() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="contained"
      disabled={pending}
      startIcon={<AppIcon name="success" size={20} />}
      sx={{ alignSelf: 'flex-start' }}
    >
      {pending ? t('trust.noticeForm.saving') : t('trust.noticeForm.save')}
    </Button>
  );
}

interface Props {
  tenantId: string;
  engagementId: string;
  organisation: string;
  stored: Partial<NoticeInput>;
  gaps: readonly NoticeGap[];
  retentionDays: number | null;
  publicHref: string;
}

/** Privacy notice fields of an engagement, with a "not configured yet" warning (TASK-U). */
export default function NoticeForm(p: Props) {
  const { t } = useI18n();
  const [state, action] = useFormState(saveNoticeAction, INITIAL);
  return (
    <Stack component="form" action={action} sx={{ gap: 4 }} aria-labelledby="notice-title">
      <input type="hidden" name="tenantId" value={p.tenantId} />
      <input type="hidden" name="engagementId" value={p.engagementId} />
      <div>
        <Typography id="notice-title" variant="sectionTitle" component="h2">
          {t('trust.noticeForm.title')}
        </Typography>
        <Typography color="text.secondary">{t('trust.noticeForm.intro')}</Typography>
      </div>
      {p.gaps.length > 0 ? (
        <Alert severity="warning" icon={<AppIcon name="warning" />} data-testid="notice-warning">
          <strong>{t('trust.noticeForm.warnTitle')}</strong>
          <ul style={{ margin: '4px 0' }}>
            {p.gaps.map((g) => (
              <li key={g}>{t(GAP_KEY[g])}</li>
            ))}
          </ul>
          {t('trust.noticeForm.warnHint')}
        </Alert>
      ) : (
        <StatusText status="success">{t('trust.noticeForm.allSet')}</StatusText>
      )}
      <Typography variant="body2" color="text.secondary">
        {p.retentionDays === null
          ? t('trust.noticeForm.retentionMissing')
          : t('trust.noticeForm.retention', { days: p.retentionDays })}
      </Typography>
      <TextField
        name="controller"
        label={t('trust.noticeForm.controller')}
        helperText={t('trust.noticeForm.controllerHelp', { org: p.organisation })}
        defaultValue={p.stored.controller ?? ''}
        inputProps={{ maxLength: 160 }}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 3 }}>
        <TextField
          name="contactName"
          label={t('trust.noticeForm.contactName')}
          defaultValue={p.stored.contactName ?? ''}
          inputProps={{ maxLength: 160 }}
          sx={{ flex: 1 }}
        />
        <TextField
          name="contactEmail"
          type="email"
          label={t('trust.noticeForm.contactEmail')}
          defaultValue={p.stored.contactEmail ?? ''}
          sx={{ flex: 1 }}
        />
      </Stack>
      <TextField
        name="purpose"
        label={t('trust.noticeForm.purpose')}
        helperText={t('trust.noticeForm.purposeHelp')}
        defaultValue={p.stored.purpose ?? ''}
        multiline
        minRows={2}
        inputProps={{ maxLength: 600 }}
      />
      <TextField
        select
        name="basis"
        label={t('trust.noticeForm.basis')}
        defaultValue={p.stored.basis ?? 'consent'}
        slotProps={{ inputLabel: { shrink: true } }}
        sx={{ maxWidth: 420 }}
      >
        <MenuItem value="consent">{t('trust.noticeForm.basisConsent')}</MenuItem>
        <MenuItem value="legitimate_interest">{t('trust.noticeForm.basisInterest')}</MenuItem>
      </TextField>
      <TextField
        name="providers"
        label={t('trust.noticeForm.providers')}
        defaultValue={(p.stored.providers ?? []).join('\n')}
        multiline
        minRows={2}
      />
      <TextField
        name="region"
        label={t('trust.noticeForm.region')}
        defaultValue={p.stored.region ?? ''}
        inputProps={{ maxLength: 160 }}
        sx={{ maxWidth: 420 }}
      />
      <FormControlLabel
        control={<Switch name="aiOn" defaultChecked={p.stored.aiOn === true} />}
        label={t('trust.noticeForm.aiOn')}
      />
      <TextField
        name="aiRoute"
        label={t('trust.noticeForm.aiRoute')}
        helperText={t('trust.noticeForm.aiHelp')}
        defaultValue={p.stored.aiRoute ?? ''}
        inputProps={{ maxLength: 160 }}
        sx={{ maxWidth: 420 }}
      />
      <div aria-live="polite">
        {state.message ? (
          <StatusText status={state.ok ? 'success' : 'error'}>{state.message}</StatusText>
        ) : null}
      </div>
      <Stack direction="row" sx={{ gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <Save />
        <Button variant="text" href={p.publicHref} target="_blank" rel="noopener">
          {t('trust.noticeForm.viewPublic')}
        </Button>
      </Stack>
    </Stack>
  );
}
