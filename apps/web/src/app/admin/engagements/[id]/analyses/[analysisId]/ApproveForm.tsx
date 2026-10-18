'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { AnalysisId, TenantId } from '@auditai/contracts';
import { useI18n } from '@/components/I18nProvider';
import { approveAnalysisAction, type ApproveActionState } from './actions';

const INITIAL: ApproveActionState = { ok: false, message: '' };

function SubmitButton() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending ? t('admin.analysis.approving') : t('admin.analysis.approve')}
    </button>
  );
}

interface Props {
  tenantId: TenantId;
  analysisId: AnalysisId;
}

/**
 * Client form for the auditor approval action (M10). The form posts to the server action
 * declared in `./actions.ts`. The `useFormState` hook surfaces the result inline.
 */
export function ApproveForm({ tenantId, analysisId }: Props) {
  const { t } = useI18n();
  const [state, formAction] = useFormState(approveAnalysisAction, INITIAL);
  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="analysisId" value={analysisId} />
      <p>
        <label htmlFor="rationale">{t('admin.analysis.rationaleLabel')}</label>
        <br />
        <textarea
          id="rationale"
          name="rationale"
          rows={3}
          maxLength={2000}
          placeholder={t('admin.analysis.rationalePlaceholder')}
        />
      </p>
      <p>
        <SubmitButton />
        {state.message ? (
          <span className="status-msg" aria-live="polite">
            {state.ok ? '\u2705' : '\u26a0\ufe0f'} {state.message}
            {state.result
              ? ` ${t('admin.analysis.auditRef', { id: state.result.auditLogId })}`
              : ''}
          </span>
        ) : null}
      </p>
    </form>
  );
}
