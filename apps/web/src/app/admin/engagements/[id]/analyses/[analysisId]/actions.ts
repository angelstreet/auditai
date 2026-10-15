'use server';

/**
 * Auditor approval server action (M10, FR-08, PRD §10).
 *
 * The form action is invoked by the detail page when the auditor clicks "Approve". The actor
 * identity is supplied by a header (`x-audit-actor-id`) so the smoke can drive the action
 * without a real session; the production app will replace this with the authenticated user
 * once SSO / MFA land (Gate C). The action is intentionally narrow: it accepts the analysis
 * id and a free-text rationale, calls `approveAnalysis`, and returns the result.
 */

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import {
  approvalResultSchema,
  approveAnalysis,
  findAuditorForTenant,
  getAnalysis,
} from '@/lib/auditorData';
import type { AnalysisId, TenantId, UserId } from '@auditai/contracts';

export interface ApproveActionState {
  ok: boolean;
  message: string;
  result?: ReturnType<typeof approvalResultSchema.parse>;
}

const isUuidV4 = (v: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export async function approveAnalysisAction(
  _prev: ApproveActionState,
  formData: FormData,
): Promise<ApproveActionState> {
  const tenantId = String(formData.get('tenantId') ?? '');
  const analysisId = String(formData.get('analysisId') ?? '');
  const rationale = String(formData.get('rationale') ?? '').trim();

  if (!isUuidV4(tenantId) || !isUuidV4(analysisId)) {
    return { ok: false, message: 'Invalid tenant or analysis id' };
  }

  // The actor is the first auditor membership of the tenant. In production this will be
  // the authenticated session user (Gate C, not in M10).
  const headerActor = headers().get('x-audit-actor-id');
  const actor =
    (headerActor && isUuidV4(headerActor) ? (headerActor as UserId) : null) ??
    (await findAuditorForTenant(tenantId as TenantId));
  if (!actor) {
    return { ok: false, message: 'No auditor membership found for this tenant' };
  }

  try {
    const result = await approveAnalysis(tenantId as TenantId, analysisId as AnalysisId, actor, {
      rationale: rationale || undefined,
    });
    if (!result) {
      return { ok: false, message: 'Analysis not found in this tenant' };
    }
    const detail = await getAnalysis(tenantId as TenantId, analysisId as AnalysisId);
    revalidatePath(`/admin/engagements/[id]/analyses`, 'page');
    if (detail) {
      revalidatePath(`/admin/engagements/${detail.engagementId}/analyses/${analysisId}`, 'page');
    }
    return { ok: true, message: 'Approved', result };
  } catch (err) {
    return {
      ok: false,
      message: `Approve failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
