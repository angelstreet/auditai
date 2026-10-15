'use server';

/**
 * M11 server actions for the opportunity register.
 *
 * Both actions narrow the actor identity by the same pattern as the M10 approve action:
 * honour an `x-audit-actor-id` header if present, otherwise fall back to the first auditor
 * membership of the tenant. Gate C (SSO + MFA) replaces this fallback with the real session.
 */

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import {
  opportunityStatusSchema,
  type AnalysisId,
  type OpportunityId,
  type OpportunityStatus,
  type TenantId,
  type UserId,
} from '@auditai/contracts';
import { createOpportunityFromAnalysis, transitionOpportunity } from '@/lib/opportunityData';
import { findAuditorForTenant } from '@/lib/auditorData';

const isUuidV4 = (v: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export interface CreateOpportunityActionState {
  ok: boolean;
  message: string;
  opportunityId?: OpportunityId;
  auditLogId?: string;
}

export async function createOpportunityAction(
  _prev: CreateOpportunityActionState,
  formData: FormData,
): Promise<CreateOpportunityActionState> {
  const tenantId = String(formData.get('tenantId') ?? '');
  const analysisId = String(formData.get('analysisId') ?? '');
  const engagementId = String(formData.get('engagementId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const axisRaw = String(formData.get('axis') ?? '').trim();
  const impactRaw = String(formData.get('impactScore') ?? '').trim();

  if (!isUuidV4(tenantId) || !isUuidV4(analysisId) || !isUuidV4(engagementId)) {
    return { ok: false, message: 'Invalid tenant, analysis, or engagement id' };
  }
  if (title.length < 3 || title.length > 200) {
    return { ok: false, message: 'Title must be 3 \u2013 200 characters' };
  }
  let impactScore: number | null = null;
  if (impactRaw) {
    const n = Number(impactRaw);
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      return { ok: false, message: 'Impact score must be between 0 and 1' };
    }
    impactScore = n;
  }

  const headerActor = headers().get('x-audit-actor-id');
  const actor =
    (headerActor && isUuidV4(headerActor) ? (headerActor as UserId) : null) ??
    (await findAuditorForTenant(tenantId as TenantId));
  if (!actor) return { ok: false, message: 'No auditor membership found for this tenant' };

  try {
    const result = await createOpportunityFromAnalysis(
      tenantId as TenantId,
      analysisId as AnalysisId,
      actor,
      {
        title,
        axis: axisRaw === '' ? null : axisRaw,
        impactScore,
      },
    );
    if (!result) {
      return { ok: false, message: 'Analysis not found in this tenant' };
    }
    revalidatePath(`/admin/engagements/${engagementId}/opportunities`, 'page');
    revalidatePath(
      `/admin/engagements/${engagementId}/opportunities/${result.opportunity.id}`,
      'page',
    );
    revalidatePath(`/admin/engagements/${engagementId}/analyses/${analysisId}`, 'page');
    return {
      ok: true,
      message: 'Opportunity created',
      opportunityId: result.opportunity.id,
      auditLogId: result.auditLogId,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Create failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export interface TransitionActionState {
  ok: boolean;
  message: string;
  pending?: boolean;
}

export async function transitionOpportunityAction(
  _prev: TransitionActionState,
  formData: FormData,
): Promise<TransitionActionState> {
  const tenantId = String(formData.get('tenantId') ?? '');
  const opportunityId = String(formData.get('opportunityId') ?? '');
  const to = String(formData.get('to') ?? '');
  if (!isUuidV4(tenantId) || !isUuidV4(opportunityId)) {
    return { ok: false, message: 'Invalid tenant or opportunity id' };
  }
  const parsed = opportunityStatusSchema.safeParse(to);
  if (!parsed.success) {
    return { ok: false, message: `Invalid target status: ${to}` };
  }
  const headerActor = headers().get('x-audit-actor-id');
  const actor =
    (headerActor && isUuidV4(headerActor) ? (headerActor as UserId) : null) ??
    (await findAuditorForTenant(tenantId as TenantId));
  if (!actor) return { ok: false, message: 'No auditor membership found for this tenant' };

  try {
    const result = await transitionOpportunity(
      tenantId as TenantId,
      opportunityId as OpportunityId,
      parsed.data as OpportunityStatus,
      actor,
    );
    if (!result) {
      return { ok: false, message: 'Opportunity not found in this tenant' };
    }
    revalidatePath(`/admin/engagements/[id]/opportunities`, 'page');
    revalidatePath(`/admin/engagements/[id]/opportunities/${opportunityId}`, 'page');
    return {
      ok: true,
      message: `Status set to ${result.opportunity.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Transition failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
