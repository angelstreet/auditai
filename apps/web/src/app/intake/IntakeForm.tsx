'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { TenantId } from '@evolai/contracts';
import { useI18n } from '@/components/I18nProvider';
import { saveSponsorBriefAction, type IntakeActionState } from './actions';

const INITIAL: IntakeActionState = { ok: false, message: '' };

function SubmitButton() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending ? t('intake.saving') : t('intake.save')}
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
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

interface Props {
  tenantId: TenantId;
}

export function IntakeForm({ tenantId }: Props) {
  const { t } = useI18n();
  const [state, formAction] = useFormState(saveSponsorBriefAction, INITIAL);
  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />

      <div className="card">
        <h3>{t('intake.s1Title')}</h3>
        <p className="muted">{t('intake.s1Desc')}</p>
        <p>
          <label htmlFor="topPriorityWorkflow">{t('intake.topPriorityLabel')}</label>
          <input
            id="topPriorityWorkflow"
            name="topPriorityWorkflow"
            type="text"
            placeholder={t('intake.topPriorityPlaceholder')}
          />
        </p>
        <p>
          <label>{t('intake.departmentsLabel')}</label>
          <div className="chips">
            <Chip
              name="departmentsInScope"
              value="operations"
              label={t('intake.dept.operations')}
              defaultChecked
            />
            <Chip
              name="departmentsInScope"
              value="sales"
              label={t('intake.dept.sales')}
              defaultChecked
            />
            <Chip name="departmentsInScope" value="finance" label={t('intake.dept.finance')} />
            <Chip name="departmentsInScope" value="legal" label={t('intake.dept.legal')} />
            <Chip
              name="departmentsInScope"
              value="engineering"
              label={t('intake.dept.engineering')}
            />
            <Chip name="departmentsInScope" value="people" label={t('intake.dept.people')} />
          </div>
        </p>
        <p>
          <label>{t('intake.sensitivityLabel')}</label>
          <div className="chips">
            <Chip
              name="dataSensitivityBoundary"
              value="internal_only"
              label={t('intake.sens.internal_only')}
              defaultChecked
            />
            <Chip
              name="dataSensitivityBoundary"
              value="public_web"
              label={t('intake.sens.public_web')}
            />
            <Chip
              name="dataSensitivityBoundary"
              value="customer_pii"
              label={t('intake.sens.customer_pii')}
            />
            <Chip
              name="dataSensitivityBoundary"
              value="regulated"
              label={t('intake.sens.regulated')}
            />
          </div>
        </p>
      </div>

      <div className="card">
        <h3>{t('intake.s2Title')}</h3>
        <p className="muted">{t('intake.s2Desc')}</p>
        <p>
          <label htmlFor="annualBudgetEur">{t('intake.budgetLabel')}</label>
          <input
            id="annualBudgetEur"
            name="annualBudgetEur"
            type="text"
            defaultValue=""
            placeholder={t('intake.budgetPlaceholder')}
          />
        </p>
        <p>
          <label htmlFor="onsiteAppetite">{t('intake.onsiteLabel')}</label>
          <select id="onsiteAppetite" name="onsiteAppetite" defaultValue="limited_team">
            <option value="">{t('common.dash')}</option>
            <option value="full_pilot">{t('intake.onsiteOpt.full_pilot')}</option>
            <option value="limited_team">{t('intake.onsiteOpt.limited_team')}</option>
            <option value="remote_only">{t('intake.onsiteOpt.remote_only')}</option>
          </select>
        </p>
      </div>

      <div className="card">
        <h3>{t('intake.s3Title')}</h3>
        <p className="muted">{t('intake.s3Desc')}</p>
        <p>
          <label>{t('intake.regionsLabel')}</label>
          <div className="chips">
            <Chip
              name="approvedModelRegions"
              value="eu_only"
              label={t('intake.region.eu_only')}
              defaultChecked
            />
            <Chip
              name="approvedModelRegions"
              value="us_enterprise"
              label={t('intake.region.us_enterprise')}
            />
            <Chip
              name="approvedModelRegions"
              value="self_hosted"
              label={t('intake.region.self_hosted')}
            />
            <Chip
              name="approvedModelRegions"
              value="no_constraint"
              label={t('intake.region.no_constraint')}
            />
          </div>
        </p>
        <p>
          <label>{t('intake.residencyLabel')}</label>
          <div className="chips">
            <Chip
              name="dataResidency"
              value="eu_frankfurt"
              label={t('intake.res.eu_frankfurt')}
              defaultChecked
            />
            <Chip name="dataResidency" value="us" label={t('intake.res.us')} />
            <Chip name="dataResidency" value="client_vpc" label={t('intake.res.client_vpc')} />
          </div>
        </p>
        <p>
          <label htmlFor="promptInjectionReview">{t('intake.injectionLabel')}</label>
          <select
            id="promptInjectionReview"
            name="promptInjectionReview"
            defaultValue="external_auditor"
          >
            <option value="">{t('common.dash')}</option>
            <option value="external_auditor">{t('intake.injection.external_auditor')}</option>
            <option value="internal">{t('intake.injection.internal')}</option>
            <option value="none_yet">{t('intake.injection.none_yet')}</option>
          </select>
        </p>
      </div>

      <div className="card">
        <h3>{t('intake.s4Title')}</h3>
        <p className="muted">{t('intake.s4Desc')}</p>
        {(['leadershipLiteracy', 'operationalAdoption', 'policyGovernance'] as const).map((k) => (
          <p key={k}>
            <label htmlFor={k}>{t(`intake.${k}`)}</label>
            <input id={k} name={k} type="range" min={0} max={5} defaultValue={2} />
          </p>
        ))}
      </div>

      <p>
        <SubmitButton />
        {state.message ? (
          <span className="status-msg" aria-live="polite">
            {state.ok ? '\u2705' : '\u26a0\ufe0f'} {state.message}
            {state.briefId ? ` (${state.briefId})` : ''}
          </span>
        ) : null}
      </p>
    </form>
  );
}
