'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { OpportunityId, OpportunityStatus, TenantId } from '@evolai/contracts';
import { useI18n } from '@/components/I18nProvider';
import { transitionOpportunityAction, type TransitionActionState } from '../actions';

const INITIAL: TransitionActionState = { ok: false, message: '' };

interface Props {
  tenantId: TenantId;
  opportunityId: OpportunityId;
  current: OpportunityStatus;
  options: ReadonlyArray<OpportunityStatus>;
}

/**
 * Form for the M11 status transition flow. The form posts to the server action
 * `transitionOpportunityAction`, which validates the transition via
 * `opportunityStatusTransitionSchema` and writes the audit log entry in the same
 * transaction. Each allowed "next" status is rendered as its own submit button whose
 * `name="to"` `value` carries the destination status into the form payload.
 */
function SubmitButton({ value, label }: { value: OpportunityStatus; label: string }) {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="to"
      value={value}
      disabled={pending}
      className="btn btn-primary btn-sm"
    >
      {pending ? t('admin.oppDetail.updating') : label}
    </button>
  );
}

export function TransitionForm({ tenantId, opportunityId, current, options }: Props) {
  const { t } = useI18n();
  const [state, formAction] = useFormState(transitionOpportunityAction, INITIAL);
  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <p className="muted">{t('admin.oppDetail.current', { status: t(`status.${current}`) })}</p>
      <p>
        {options.map((s) => (
          <SubmitButton key={s} value={s} label={t(`status.${s}`)} />
        ))}
      </p>
      {state.message ? (
        <p aria-live="polite">
          {state.ok ? '\u2705' : '\u26a0\ufe0f'} {state.message}
        </p>
      ) : null}
    </form>
  );
}
