'use client';

import { memo, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AppIcon, ConfirmDialog, StatusText } from '@evolai/ui';
import type { TenantId } from '@evolai/contracts';
import { useI18n } from '@/components/I18nProvider';
import { enumLabelOf } from '@/lib/enumLabel';
import type { ErasurePreview } from '@/lib/deletionData';
import {
  handleRequestAction,
  previewErasureAction,
  triggerDeletePseudonymAction,
  triggerExportAction,
  type DataActionState,
} from './actions';

const INITIAL: DataActionState = { ok: false, message: '' };

const KINDS = [
  'opportunities',
  'analyses',
  'respondent_badges',
  'team_badges',
  'synergies',
  'audit_log',
] as const;

const PSEUDONYM_PATTERN = /^[a-z0-9-]{8,64}$/;

function Result({ state }: { state: DataActionState }) {
  return (
    <Box aria-live="polite" sx={{ minHeight: 24 }}>
      {state.message ? (
        <StatusText status={state.ok ? 'success' : 'error'}>{state.message}</StatusText>
      ) : null}
    </Box>
  );
}

// Memoised so typing or opening the dialog never re-renders it: React rewrites a hidden input's
// value on every render, which would also undo the forged-tenant check in e2e/auth.spec.ts.
const TenantField = memo(function TenantField({ tenantId }: { tenantId: TenantId }) {
  return <input type="hidden" name="tenantId" value={tenantId} />;
});

function ExportSubmit() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="contained"
      disabled={pending}
      startIcon={<AppIcon name="download" size={20} />}
      sx={{ minWidth: 160 }}
    >
      {pending ? t('admin.data.working') : t('admin.data.runExport')}
    </Button>
  );
}

interface Props {
  tenantId: TenantId;
}

/** Export is the one primary action of the data page (UI_RULES §3). */
export function ExportForm({ tenantId }: Props) {
  const { t } = useI18n();
  const [state, formAction] = useFormState(triggerExportAction, INITIAL);
  return (
    <Stack component="form" action={formAction} sx={{ gap: 3 }}>
      <TenantField tenantId={tenantId} />
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 3, alignItems: { sm: 'center' } }}>
        <TextField
          select
          name="kind"
          label={t('admin.data.exportKind')}
          defaultValue="opportunities"
          required
          sx={{ minWidth: 240 }}
        >
          {KINDS.map((k) => (
            <MenuItem key={k} value={k}>
              {enumLabelOf(t, 'exportKind', k)}
            </MenuItem>
          ))}
        </TextField>
        <ExportSubmit />
      </Stack>
      <Result state={state} />
      {state.csv ? (
        <Button
          component="a"
          variant="outlined"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${state.csv.body}`)}`}
          download={state.csv.filename}
          startIcon={<AppIcon name="download" size={20} />}
          sx={{ alignSelf: 'flex-start' }}
          data-testid="export-download"
        >
          {t('admin.setup.data.download')} ({state.csv.filename})
        </Button>
      ) : null}
      {state.csv ? (
        <pre className="csv-preview" aria-label={t('admin.data.csvPreview')}>
          {state.csv.body.slice(0, 1200)}
          {state.csv.body.length > 1200 ? '\n…' : ''}
        </pre>
      ) : null}
    </Stack>
  );
}

/**
 * Erase: an outlined danger button that only opens a confirm dialog; the filled danger button lives
 * inside the dialog (UI_RULES §3). Confirming submits the form, so the server action is unchanged.
 */
export function DeleteForm({ tenantId, initialCode = '' }: Props & { initialCode?: string }) {
  const { t } = useI18n();
  const [state, formAction] = useFormState(triggerDeletePseudonymAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [pseudonym, setPseudonym] = useState(initialCode);
  const [typed, setTyped] = useState('');
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ErasurePreview | null>(null);
  const [checking, setChecking] = useState(false);
  // Said before any dialog: an unknown code never reaches the confirmation step (TASK-U).
  const [notFound, setNotFound] = useState('');
  const valid = PSEUDONYM_PATTERN.test(pseudonym);
  return (
    <Stack component="form" ref={formRef} action={formAction} sx={{ gap: 3 }}>
      <TenantField tenantId={tenantId} />
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 3, alignItems: { sm: 'center' } }}>
        <TextField
          name="respondentPseudonym"
          label={t('admin.data.pseudonym')}
          placeholder={t('admin.data.pseudonymPlaceholder')}
          value={pseudonym}
          onChange={(e) => {
            setPseudonym(e.target.value.trim());
            setNotFound('');
          }}
          required
          helperText={t('admin.setup.data.codeHelp')}
          inputProps={{ pattern: '[a-z0-9-]{8,64}', autoComplete: 'off', spellCheck: false }}
          sx={{ minWidth: 280 }}
        />
        <input type="hidden" name="confirmCode" value={typed} />
        <Button
          variant="outlined"
          color="error"
          disabled={!valid || checking}
          onClick={async () => {
            setChecking(true);
            setNotFound('');
            const fd = new FormData();
            fd.set('tenantId', tenantId);
            fd.set('respondentPseudonym', pseudonym);
            const res = await previewErasureAction({ ok: false, message: '' }, fd);
            setChecking(false);
            if (!res.ok || !res.preview) {
              setNotFound(res.message);
              return;
            }
            setPreview(res.preview);
            setTyped('');
            setOpen(true);
          }}
          startIcon={<AppIcon name="delete" size={20} />}
          sx={{ minWidth: 160 }}
        >
          {checking ? t('trust.data.checking') : t('admin.data.erase')}
        </Button>
      </Stack>
      <Result state={notFound ? { ok: false, message: notFound } : state} />
      <ConfirmDialog
        open={open}
        danger
        title={t('admin.data.eraseConfirmTitle')}
        body={t('admin.data.eraseConfirmBody', { pseudonym })}
        confirmLabel={t('admin.data.erase')}
        cancelLabel={t('admin.data.cancel')}
        confirmDisabled={typed !== pseudonym}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          formRef.current?.requestSubmit();
        }}
      >
        {preview ? (
          <Box data-testid="erase-preview" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" component="p">
              {t('trust.data.previewTitle')}
            </Typography>
            <ul>
              <li>{t('trust.data.previewLinks', { n: preview.links })}</li>
              <li>{t('trust.data.previewSurveys', { n: preview.surveys })}</li>
              <li>{t('trust.data.previewAnswers', { n: preview.answers })}</li>
              <li>{t('trust.data.previewMascots', { n: preview.mascots })}</li>
            </ul>
            <Typography variant="body2" color="text.secondary">
              {t('trust.data.previewIrreversible')}
            </Typography>
          </Box>
        ) : null}
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label={t('admin.setup.data.confirmField')}
          helperText={t('admin.setup.data.confirmType', { code: pseudonym })}
          value={typed}
          onChange={(e) => setTyped(e.target.value.trim())}
          inputProps={{ autoComplete: 'off', spellCheck: false }}
        />
      </ConfirmDialog>
    </Stack>
  );
}

/** "Mark as handled" for one privacy request; the list refreshes after the action. */
export function HandleRequestForm({ tenantId, id }: { tenantId: TenantId; id: string }) {
  const { t } = useI18n();
  const [state, formAction] = useFormState(handleRequestAction, INITIAL);
  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="small" variant="outlined">
        {t('trust.data.handle')}
      </Button>
      {state.message && !state.ok ? <StatusText status="error">{state.message}</StatusText> : null}
    </form>
  );
}
