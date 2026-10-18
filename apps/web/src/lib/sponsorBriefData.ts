import type { SponsorBrief, TenantId } from '@evolai/contracts';
import { withTenant, withServiceAccount } from './db';

/**
 * Sponsor brief data layer (M12, FR-08, PRD §4, §9, §15).
 *
 * The intake form posts the full payload to the server action which calls
 * `createSponsorBrief`. The list / "latest" queries support the portfolio board
 * (M12) and the analyst overview (M10+). Reads run as a service account so the
 * board can aggregate across the analyst and the sponsor memberships; writes run
 * under `withTenant` so RLS gates them to the actor's tenant.
 */

interface SponsorBriefRow {
  id: string;
  tenant_id: string;
  sponsor_user_id: string | null;
  top_priority_workflow: string;
  departments_in_scope: string[];
  data_sensitivity_boundary: string[];
  annual_budget_eur: string | null;
  onsite_appetite: string | null;
  approved_model_regions: string[];
  data_residency: string[];
  prompt_injection_review: string | null;
  leadership_literacy: number | null;
  operational_adoption: number | null;
  policy_governance: number | null;
  created_at: string;
  updated_at: string;
}

const fromRow = (r: SponsorBriefRow): SponsorBrief => ({
  id: r.id,
  tenantId: r.tenant_id as SponsorBrief['tenantId'],
  sponsorUserId: r.sponsor_user_id as SponsorBrief['sponsorUserId'],
  topPriorityWorkflow: r.top_priority_workflow,
  departmentsInScope: r.departments_in_scope as SponsorBrief['departmentsInScope'],
  dataSensitivityBoundary: r.data_sensitivity_boundary as SponsorBrief['dataSensitivityBoundary'],
  annualBudgetEur: r.annual_budget_eur === null ? null : Number(r.annual_budget_eur),
  onsiteAppetite: r.onsite_appetite as SponsorBrief['onsiteAppetite'],
  approvedModelRegions: r.approved_model_regions as SponsorBrief['approvedModelRegions'],
  dataResidency: r.data_residency as SponsorBrief['dataResidency'],
  promptInjectionReview: r.prompt_injection_review as SponsorBrief['promptInjectionReview'],
  leadershipLiteracy: r.leadership_literacy,
  operationalAdoption: r.operational_adoption,
  policyGovernance: r.policy_governance,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const createSponsorBrief = async (
  tenantId: TenantId,
  payload: Omit<SponsorBrief, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
): Promise<SponsorBrief> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<SponsorBriefRow>(
      `INSERT INTO sponsor_briefs (
         tenant_id, sponsor_user_id,
         top_priority_workflow, departments_in_scope, data_sensitivity_boundary,
         annual_budget_eur, onsite_appetite,
         approved_model_regions, data_residency, prompt_injection_review,
         leadership_literacy, operational_adoption, policy_governance
       ) VALUES (
         $1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13
       )
       RETURNING id, tenant_id, sponsor_user_id,
                 top_priority_workflow, departments_in_scope, data_sensitivity_boundary,
                 annual_budget_eur, onsite_appetite,
                 approved_model_regions, data_residency, prompt_injection_review,
                 leadership_literacy, operational_adoption, policy_governance,
                 created_at, updated_at`,
      [
        tenantId,
        payload.sponsorUserId,
        payload.topPriorityWorkflow,
        JSON.stringify(payload.departmentsInScope),
        JSON.stringify(payload.dataSensitivityBoundary),
        payload.annualBudgetEur,
        payload.onsiteAppetite,
        JSON.stringify(payload.approvedModelRegions),
        JSON.stringify(payload.dataResidency),
        payload.promptInjectionReview,
        payload.leadershipLiteracy,
        payload.operationalAdoption,
        payload.policyGovernance,
      ],
    );
    return fromRow(rows[0] as SponsorBriefRow);
  });
};

export const getLatestSponsorBrief = async (tenantId: TenantId): Promise<SponsorBrief | null> => {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<SponsorBriefRow>(
      `SELECT id, tenant_id, sponsor_user_id,
              top_priority_workflow, departments_in_scope, data_sensitivity_boundary,
              annual_budget_eur, onsite_appetite,
              approved_model_regions, data_residency, prompt_injection_review,
              leadership_literacy, operational_adoption, policy_governance,
              created_at, updated_at
         FROM sponsor_briefs
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [tenantId],
    );
    const row = rows[0];
    return row ? fromRow(row) : null;
  });
};

export const listLatestSponsorBriefs = async (): Promise<
  Array<SponsorBrief & { tenantName: string }>
> => {
  return withServiceAccount(async (client) => {
    const { rows } = await client.query<SponsorBriefRow & { display_name: string }>(
      `SELECT DISTINCT ON (b.tenant_id)
              b.id, b.tenant_id, b.sponsor_user_id,
              b.top_priority_workflow, b.departments_in_scope, b.data_sensitivity_boundary,
              b.annual_budget_eur, b.onsite_appetite,
              b.approved_model_regions, b.data_residency, b.prompt_injection_review,
              b.leadership_literacy, b.operational_adoption, b.policy_governance,
              b.created_at, b.updated_at,
              t.display_name
         FROM sponsor_briefs b
         JOIN tenants t ON t.id = b.tenant_id
        ORDER BY b.tenant_id, b.created_at DESC`,
    );
    return rows.map((r) => ({ ...fromRow(r), tenantName: r.display_name }));
  });
};
