'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { TenantId } from '@evolai/contracts';
import { useI18n } from '@/components/I18nProvider';
import { enumLabelOf } from '@/lib/enumLabel';
import { triggerDeletePseudonymAction, triggerExportAction, type DataActionState } from './actions';

const INITIAL: DataActionState = { ok: false, message: '' };

const KINDS = [
  'opportunities',
  'analyses',
  'respondent_badges',
  'team_badges',
  'synergies',
  'audit_log',
] as const;

function Submit({ label, danger = false }: { label: string; danger?: boolean }) {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={danger ? 'btn btn-danger' : 'btn btn-primary'}
    >
      {pending ? t('admin.data.working') : label}
    </button>
  );
}

interface Props {
  tenantId: TenantId;
}

export function ExportForm({ tenantId }: Props) {
  const { t } = useI18n();
  const [state, formAction] = useFormState(triggerExportAction, INITIAL);
  return (
    <form action={formAction} className="form-row">
      <input type="hidden" name="tenantId" value={tenantId} />
      <label className="field">
        {t('admin.data.exportKind')}
        <select name="kind" defaultValue="opportunities" required>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {enumLabelOf(t, 'exportKind', k)}
            </option>
          ))}
        </select>
      </label>
      <Submit label={t('admin.data.runExport')} />
      {state.message ? (
        <span className="status-msg" aria-live="polite">
          {state.ok ? '\u2705' : '\u26a0\ufe0f'} {state.message}
        </span>
      ) : null}
      {state.csv ? (
        <pre className="csv-preview" aria-label={t('admin.data.csvPreview')}>
          {state.csv.body.slice(0, 1200)}
          {state.csv.body.length > 1200 ? '\n\u2026' : ''}
        </pre>
      ) : null}
    </form>
  );
}

export function DeleteForm({ tenantId }: Props) {
  const { t } = useI18n();
  const [state, formAction] = useFormState(triggerDeletePseudonymAction, INITIAL);
  return (
    <form action={formAction} className="form-row">
      <input type="hidden" name="tenantId" value={tenantId} />
      <label className="field">
        {t('admin.data.pseudonym')}
        <input
          name="respondentPseudonym"
          type="text"
          required
          pattern="[a-z0-9-]{8,64}"
          placeholder={t('admin.data.pseudonymPlaceholder')}
        />
      </label>
      <Submit label={t('admin.data.erase')} danger />
      {state.message ? (
        <span className="status-msg" aria-live="polite">
          {state.ok ? '\u2705' : '\u26a0\ufe0f'} {state.message}
        </span>
      ) : null}
    </form>
  );
}
