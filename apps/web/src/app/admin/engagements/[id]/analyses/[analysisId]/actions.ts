'use server';

/**
 * Auditor approval server action (M10, FR-08, PRD §10).
 *
 * The actor is the signed-in session user, and the form's tenantId is honoured only if that user
 * is a member of the tenant (ADR 0023). The action is intentionally narrow: it accepts the analysis
 * id and a free-text rationale, calls `approveAnalysis`, and returns the result.
 */

import { revalidatePath } from 'next/cache';
import { resolveActor } from '@/lib/authServer';
import { approvalResultSchema, approveAnalysis, getAnalysis } from '@/lib/auditorData';
import type { AnalysisId, TenantId } from '@auditai/contracts';

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

  const who = await resolveActor(tenantId);
  if (!who.ok) return { ok: false, message: who.message };
  const actor = who.actor;

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
