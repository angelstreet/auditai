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
    <button type="submit" disabled={pending} className="btn btn-primary">
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
    <form action={formAction} className="form-row">
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
        <span className="status-msg" aria-live="polite">
          {state.ok ? '✅' : '⚠️'} {state.message}
        </span>
      ) : null}
    </form>
  );
}
