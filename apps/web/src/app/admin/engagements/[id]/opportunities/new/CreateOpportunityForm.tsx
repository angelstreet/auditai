'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import type { AnalysisId, EngagementId, TenantId } from '@evolai/contracts';
import { useI18n } from '@/components/I18nProvider';
import { enumLabelOf } from '@/lib/enumLabel';
import { createOpportunityAction, type CreateOpportunityActionState } from '../actions';

const INITIAL: CreateOpportunityActionState = { ok: false, message: '' };

function SubmitButton() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending ? t('admin.oppNew.creating') : t('admin.oppNew.create')}
    </button>
  );
}

interface Props {
  tenantId: TenantId;
  analysisId: AnalysisId;
  engagementId: EngagementId;
  defaultTitle: string;
}

/**
 * Form for the M11 create-from-analysis flow. Submits to the server action
 * `createOpportunityAction` which calls `createOpportunityFromAnalysis` and writes
 * the `opportunity.create` audit log entry in the same transaction.
 */
export function CreateOpportunityForm({ tenantId, analysisId, engagementId, defaultTitle }: Props) {
  const { t } = useI18n();
  const [state, formAction] = useFormState(createOpportunityAction, INITIAL);
  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="engagementId" value={engagementId} />
      <input type="hidden" name="analysisId" value={analysisId} />
      <p>
        <label htmlFor="title">{t('admin.oppNew.titleLabel')}</label>
        <br />
        <input
          id="title"
          name="title"
          type="text"
          required
          minLength={3}
          maxLength={200}
          defaultValue={defaultTitle}
          className="input-wide"
        />
      </p>
      <p>
        <label htmlFor="axis">{t('admin.oppNew.axisLabel')}</label>
        <br />
        <select id="axis" name="axis" defaultValue="">
          <option value="">{t('common.dash')}</option>
          <option value="literacy">{enumLabelOf(t, 'axis', 'literacy')}</option>
          <option value="practice">{enumLabelOf(t, 'axis', 'practice')}</option>
          <option value="readiness">{enumLabelOf(t, 'axis', 'readiness')}</option>
          <option value="opportunity">{enumLabelOf(t, 'axis', 'opportunity')}</option>
          <option value="context">{enumLabelOf(t, 'axis', 'context')}</option>
        </select>
      </p>
      <p>
        <label htmlFor="impactScore">{t('admin.oppNew.impactLabel')}</label>
        <br />
        <input
          id="impactScore"
          name="impactScore"
          type="number"
          min={0}
          max={1}
          step={0.001}
          className="input-narrow"
        />
      </p>
      <p>
        <SubmitButton />
        {state.message ? (
          <span className="status-msg" aria-live="polite">
            {state.ok ? '\u2705' : '\u26a0\ufe0f'} {state.message}
            {state.opportunityId ? (
              <>
                {' \u2014 '}
                <Link
                  href={`/admin/engagements/${engagementId}/opportunities/${state.opportunityId}?tenant=${tenantId}`}
                >
                  {t('admin.opps.open')}
                </Link>
              </>
            ) : null}
          </span>
        ) : null}
      </p>
    </form>
  );
}
