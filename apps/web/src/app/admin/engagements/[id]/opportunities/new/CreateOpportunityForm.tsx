'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import type { AnalysisId, EngagementId, TenantId } from '@auditai/contracts';
import { createOpportunityAction, type CreateOpportunityActionState } from '../actions';

const INITIAL: CreateOpportunityActionState = { ok: false, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Creating\u2026' : 'Create opportunity'}
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
  const [state, formAction] = useFormState(createOpportunityAction, INITIAL);
  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="engagementId" value={engagementId} />
      <input type="hidden" name="analysisId" value={analysisId} />
      <p>
        <label htmlFor="title">Title (3 \u2013 200 chars)</label>
        <br />
        <input
          id="title"
          name="title"
          type="text"
          required
          minLength={3}
          maxLength={200}
          defaultValue={defaultTitle}
          style={{ width: '100%', maxWidth: '640px', padding: '8px 10px' }}
        />
      </p>
      <p>
        <label htmlFor="axis">Axis (optional)</label>
        <br />
        <select id="axis" name="axis" defaultValue="">
          <option value="">\u2014</option>
          <option value="literacy">Literacy</option>
          <option value="practice">Practice</option>
          <option value="readiness">Readiness</option>
          <option value="opportunity">Opportunity</option>
          <option value="context">Context</option>
        </select>
      </p>
      <p>
        <label htmlFor="impactScore">Impact score (0 \u2013 1, optional)</label>
        <br />
        <input
          id="impactScore"
          name="impactScore"
          type="number"
          min={0}
          max={1}
          step={0.001}
          style={{ width: '120px', padding: '8px 10px' }}
        />
      </p>
      <p>
        <SubmitButton />
        {state.message ? (
          <span style={{ marginLeft: '12px' }} aria-live="polite">
            {state.ok ? '\u2705' : '\u26a0\ufe0f'} {state.message}
            {state.opportunityId ? (
              <>
                {' \u2014 '}
                <Link
                  href={`/admin/engagements/${engagementId}/opportunities/${state.opportunityId}?tenant=${tenantId}`}
                >
                  Open
                </Link>
              </>
            ) : null}
          </span>
        ) : null}
      </p>
    </form>
  );
}
