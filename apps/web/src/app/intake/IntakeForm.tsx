'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { TenantId } from '@auditai/contracts';
import { saveSponsorBriefAction, type IntakeActionState } from './actions';

const INITIAL: IntakeActionState = { ok: false, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? 'Saving\u2026' : 'Save brief'}
    </button>
  );
}

interface ChipProps {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
}

function Chip({ name, value, label, defaultChecked }: ChipProps) {
  return (
    <label className="chip">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        style={{ display: 'none' }}
      />
      {label}
    </label>
  );
}

interface Props {
  tenantId: TenantId;
}

export function IntakeForm({ tenantId }: Props) {
  const [state, formAction] = useFormState(saveSponsorBriefAction, INITIAL);
  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />

      <div className="card">
        <h3>1 · AI requirements</h3>
        <p className="desc">
          Which processes or outcomes does leadership want AI to improve first?
        </p>
        <p>
          <label htmlFor="topPriorityWorkflow">Top priority workflow</label>
          <input
            id="topPriorityWorkflow"
            name="topPriorityWorkflow"
            type="text"
            placeholder="e.g. Reduce source-checking time on outbound client deliverables"
          />
        </p>
        <p>
          <label>Departments in scope</label>
          <div className="chips">
            <Chip name="departmentsInScope" value="operations" label="Operations" defaultChecked />
            <Chip name="departmentsInScope" value="sales" label="Sales" defaultChecked />
            <Chip name="departmentsInScope" value="finance" label="Finance" />
            <Chip name="departmentsInScope" value="legal" label="Legal" />
            <Chip name="departmentsInScope" value="engineering" label="Engineering" />
            <Chip name="departmentsInScope" value="people" label="People" />
          </div>
        </p>
        <p>
          <label>Data sensitivity boundary</label>
          <div className="chips">
            <Chip
              name="dataSensitivityBoundary"
              value="internal_only"
              label="Internal only"
              defaultChecked
            />
            <Chip name="dataSensitivityBoundary" value="public_web" label="Public web" />
            <Chip name="dataSensitivityBoundary" value="customer_pii" label="Customer PII" />
            <Chip name="dataSensitivityBoundary" value="regulated" label="Regulated" />
          </div>
        </p>
      </div>

      <div className="card">
        <h3>2 · Budget envelope</h3>
        <p className="desc">Optional. Used to rank opportunities, never to gate them.</p>
        <p>
          <label htmlFor="annualBudgetEur">Annual AI tooling &amp; advisory budget (\u20ac)</label>
          <input
            id="annualBudgetEur"
            name="annualBudgetEur"
            type="text"
            defaultValue=""
            placeholder="e.g. 45000"
          />
        </p>
        <p>
          <label htmlFor="onsiteAppetite">Appetite for one off-site audit day per week</label>
          <select id="onsiteAppetite" name="onsiteAppetite" defaultValue="limited_team">
            <option value="">\u2014</option>
            <option value="full_pilot">Yes \u2014 full pilot</option>
            <option value="limited_team">Yes \u2014 limited team</option>
            <option value="remote_only">Remote only</option>
          </select>
        </p>
      </div>

      <div className="card">
        <h3>3 · Security posture</h3>
        <p className="desc">Hard constraints. Anything checked here is enforced in the platform.</p>
        <p>
          <label>Approved model regions</label>
          <div className="chips">
            <Chip name="approvedModelRegions" value="eu_only" label="EU only" defaultChecked />
            <Chip
              name="approvedModelRegions"
              value="us_enterprise"
              label="US (enterprise contract)"
            />
            <Chip name="approvedModelRegions" value="self_hosted" label="Self-hosted" />
            <Chip name="approvedModelRegions" value="no_constraint" label="No constraint" />
          </div>
        </p>
        <p>
          <label>Data residency</label>
          <div className="chips">
            <Chip name="dataResidency" value="eu_frankfurt" label="EU (Frankfurt)" defaultChecked />
            <Chip name="dataResidency" value="us" label="US" />
            <Chip name="dataResidency" value="client_vpc" label="Client VPC" />
          </div>
        </p>
        <p>
          <label htmlFor="promptInjectionReview">Prompt-injection review process</label>
          <select
            id="promptInjectionReview"
            name="promptInjectionReview"
            defaultValue="external_auditor"
          >
            <option value="">\u2014</option>
            <option value="external_auditor">Quarterly red-team by external auditor</option>
            <option value="internal">Internal review only</option>
            <option value="none_yet">No formal process yet \u2014 please propose</option>
          </select>
        </p>
      </div>

      <div className="card">
        <h3>4 · Current AI maturity (self-assessment, 0 \u2013 5)</h3>
        <p className="desc">
          Calibrates the questionnaire rotation. The first survey to every team will be tuned to
          this baseline.
        </p>
        {(['leadershipLiteracy', 'operationalAdoption', 'policyGovernance'] as const).map((k) => (
          <p key={k}>
            <label htmlFor={k}>
              {
                {
                  leadershipLiteracy: 'Leadership literacy',
                  operationalAdoption: 'Operational adoption',
                  policyGovernance: 'Policy & governance',
                }[k]
              }
            </label>
            <input id={k} name={k} type="range" min={0} max={5} defaultValue={2} />
          </p>
        ))}
      </div>

      <p>
        <SubmitButton />
        {state.message ? (
          <span style={{ marginLeft: 12 }} aria-live="polite">
            {state.ok ? '\u2705' : '\u26a0\ufe0f'} {state.message}
            {state.briefId ? ` (${state.briefId})` : ''}
          </span>
        ) : null}
      </p>

      <style>{`
        .card { background: var(--color-bg); border: 1px solid var(--color-border);
          border-radius: 8px; padding: 18px 20px; margin-bottom: 18px; }
        .card h3 { margin: 0 0 4px; font-size: 16px; }
        .card .desc { color: var(--color-muted); font-size: 13px; margin: 0 0 14px; }
        .card p { margin: 0 0 12px; }
        .card label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
        .card input[type="text"], .card select {
          width: 100%; max-width: 480px; padding: 8px 10px; border: 1px solid var(--color-border);
          border-radius: 6px; font: inherit; }
        .card input[type="range"] { width: 100%; max-width: 480px; }
        .chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .chip { padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 999px;
          font-size: 12px; cursor: pointer; user-select: none; background: var(--color-bg); }
        .chip:has(input:checked) { background: var(--color-brand-teal); color: var(--color-brand-off-white);
          border-color: var(--color-brand-teal); }
        .btn-primary { padding: 10px 18px; background: var(--color-brand-navy);
          color: var(--color-brand-off-white); border: 0; border-radius: 8px; font: inherit; cursor: pointer; }
      `}</style>
    </form>
  );
}
