'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { EngagementId, TenantId } from '@evolai/contracts';
import { StatusText } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';
import { runAnalysisAction, type RunActionState } from './actions';

const INITIAL: RunActionState = { ok: false, message: '' };

function SubmitButton() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending ? t('admin.analyses.run.running') : t('admin.analyses.run.button')}
    </button>
  );
}

interface Props {
  tenantId: TenantId;
  engagementId: EngagementId;
}

/** The one primary action of the Analyses page: run the pipeline, show how it went. */
export function RunAnalysisForm({ tenantId, engagementId }: Props) {
  const { t } = useI18n();
  const [state, formAction] = useFormState(runAnalysisAction, INITIAL);
  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="engagementId" value={engagementId} />
      <p className="muted">{t('admin.analyses.run.help')}</p>
      <p>
        <SubmitButton />
      </p>
      <div aria-live="polite">
        {state.message ? (
          <p>
            <StatusText status={state.ok ? 'success' : 'error'}>{state.message}</StatusText>
            {state.method ? <span className="muted"> {state.method}</span> : null}
          </p>
        ) : null}
      </div>
    </form>
  );
}
