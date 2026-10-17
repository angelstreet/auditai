'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { TenantId } from '@auditai/contracts';
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

function Submit({ label }: { label: string }) {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
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
    <form action={formAction} className="data-form">
      <input type="hidden" name="tenantId" value={tenantId} />
      <label>
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
        <span style={{ marginLeft: 12 }} aria-live="polite">
          {state.ok ? '\u2705' : '\u26a0\ufe0f'} {state.message}
        </span>
      ) : null}
      {state.csv ? (
        <pre className="csv-preview" aria-label={t('admin.data.csvPreview')}>
          {state.csv.body.slice(0, 1200)}
          {state.csv.body.length > 1200 ? '\n\u2026' : ''}
        </pre>
      ) : null}
      <style>{`
        .btn-primary { padding: 6px 12px; background: var(--color-brand-navy);
          color: var(--color-brand-off-white); border: 0; border-radius: 6px;
          font: inherit; cursor: pointer; }
        select { padding: 6px 8px; border: 1px solid var(--color-border); border-radius: 6px;
          font: inherit; }
        .csv-preview { background: var(--color-bg); border: 1px solid var(--color-border);
          border-radius: 6px; padding: 10px; max-width: 720px; max-height: 320px;
          overflow: auto; font-family: var(--font-mono, monospace); font-size: 11px; margin-top: 8px; }
      `}</style>
    </form>
  );
}

export function DeleteForm({ tenantId }: Props) {
  const { t } = useI18n();
  const [state, formAction] = useFormState(triggerDeletePseudonymAction, INITIAL);
  return (
    <form action={formAction} className="data-form">
      <input type="hidden" name="tenantId" value={tenantId} />
      <label>
        {t('admin.data.pseudonym')}
        <input
          name="respondentPseudonym"
          type="text"
          required
          pattern="[a-z0-9-]{8,64}"
          placeholder={t('admin.data.pseudonymPlaceholder')}
        />
      </label>
      <Submit label={t('admin.data.erase')} />
      {state.message ? (
        <span style={{ marginLeft: 12 }} aria-live="polite">
          {state.ok ? '\u2705' : '\u26a0\ufe0f'} {state.message}
        </span>
      ) : null}
      <style>{`
        .btn-primary { padding: 6px 12px; background: #b03a2e; color: var(--color-brand-off-white);
          border: 0; border-radius: 6px; font: inherit; cursor: pointer; }
        input[type=text] { padding: 6px 8px; border: 1px solid var(--color-border); border-radius: 6px;
          font: inherit; min-width: 0; width: 100%; max-width: 320px; }
      `}</style>
    </form>
  );
}
