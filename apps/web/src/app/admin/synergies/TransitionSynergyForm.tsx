'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { SynergyId, SynergyStatus, TenantId } from '@auditai/contracts';
import { useI18n } from '@/components/I18nProvider';
import { enumLabelOf } from '@/lib/enumLabel';
import { transitionSynergyAction, type SynergyTransitionState } from './actions';

const INITIAL: SynergyTransitionState = { ok: false, message: '' };

function SubmitButton() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? t('admin.synergies.saving') : t('admin.synergies.apply')}
    </button>
  );
}

interface Props {
  tenantId: TenantId;
  synergyId: SynergyId;
  currentStatus: SynergyStatus;
}

const ALLOWED: Record<SynergyStatus, ReadonlyArray<SynergyStatus>> = {
  detected: ['surfaced', 'dismissed'],
  surfaced: ['dismissed', 'archived'],
  dismissed: ['surfaced', 'archived'],
  archived: [],
};

export function TransitionSynergyForm({ tenantId, synergyId, currentStatus }: Props) {
  const { t } = useI18n();
  const [state, formAction] = useFormState(transitionSynergyAction, INITIAL);
  const nextStates = ALLOWED[currentStatus];
  return (
    <form action={formAction} className="transition-form">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="synergyId" value={synergyId} />
      <label htmlFor={`next-${synergyId}`}>{t('admin.synergies.transition')}</label>
      <select
        id={`next-${synergyId}`}
        name="nextStatus"
        defaultValue=""
        disabled={nextStates.length === 0}
      >
        <option value="">{t('admin.synergies.pickState')}</option>
        {nextStates.map((s) => (
          <option key={s} value={s}>
            {enumLabelOf(t, 'synergyStatus', s)}
          </option>
        ))}
      </select>
      <SubmitButton />
      {state.message ? (
        <span style={{ marginLeft: 12 }} aria-live="polite">
          {state.ok ? '✅' : '⚠️'} {state.message}
        </span>
      ) : null}
      <style>{`
        .transition-form { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .transition-form label { font-size: 12px; color: var(--color-muted); }
        .transition-form select { padding: 6px 8px; border: 1px solid var(--color-border);
          border-radius: 6px; font: inherit; }
        .btn-primary { padding: 6px 12px; background: var(--color-brand-navy);
          color: var(--color-brand-off-white); border: 0; border-radius: 6px;
          font: inherit; cursor: pointer; }
      `}</style>
    </form>
  );
}
