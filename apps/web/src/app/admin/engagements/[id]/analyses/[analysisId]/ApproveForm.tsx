'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { AnalysisId, TenantId } from '@auditai/contracts';
import { approveAnalysisAction, type ApproveActionState } from './actions';

const INITIAL: ApproveActionState = { ok: false, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Approving\u2026' : 'Approve analysis'}
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
  const [state, formAction] = useFormState(approveAnalysisAction, INITIAL);
  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="analysisId" value={analysisId} />
      <p>
        <label htmlFor="rationale">Rationale (optional, max 2000 chars)</label>
        <br />
        <textarea
          id="rationale"
          name="rationale"
          rows={3}
          maxLength={2000}
          style={{ width: '100%', maxWidth: '640px' }}
          placeholder="Why are you approving this analysis? The rationale is recorded in audit_log."
        />
      </p>
      <p>
        <SubmitButton />
        {state.message ? (
          <span style={{ marginLeft: '12px' }} aria-live="polite">
            {state.ok ? '\u2705' : '\u26a0\ufe0f'} {state.message}
            {state.result ? ` (audit log ${state.result.auditLogId})` : ''}
          </span>
        ) : null}
      </p>
    </form>
  );
}
