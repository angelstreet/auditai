'use server';

import { revalidatePath } from 'next/cache';
import { sponsorBriefWriteSchema, type TenantId } from '@evolai/contracts';
import { getSession, resolveActor } from '@/lib/authServer';
import { pickTenant } from '@/lib/tenantAccess';
import { createSponsorBrief } from '@/lib/sponsorBriefData';
import { getT } from '@/lib/i18n';
import { viewAsRefusal } from '@/lib/viewAsGuard';

export interface IntakeActionState {
  ok: boolean;
  message: string;
  briefId?: string;
}

const parseArrayField = (raw: FormDataEntryValue | null): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

export async function saveSponsorBriefAction(
  _prev: IntakeActionState,
  formData: FormData,
): Promise<IntakeActionState> {
  const { t } = getT();
  const readOnly = await viewAsRefusal('/intake');
  if (readOnly) return { ok: false, message: readOnly };
  // The tenant is the session's own (ADR 0037); a tenantId in the form is ignored.
  const session = await getSession();
  if (!session) return { ok: false, message: t('auth.notSignedIn') };
  const tenantId = pickTenant(session, undefined);
  if (!tenantId) return { ok: false, message: t('auth.notMember') };
  const actor = await resolveActor(tenantId);
  if (!actor.ok) return { ok: false, message: actor.message };
  const budgetRaw = String(formData.get('annualBudgetEur') ?? '').trim();
  const annualBudgetEur = budgetRaw === '' ? null : Number(budgetRaw);
  if (annualBudgetEur !== null && (!Number.isFinite(annualBudgetEur) || annualBudgetEur < 0)) {
    return { ok: false, message: t('intake.errBudget') };
  }
  const maturityField = (key: string): number | null => {
    const raw = String(formData.get(key) ?? '').trim();
    if (raw === '') return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 5) return null;
    return n;
  };
  const candidate = {
    tenantId,
    sponsorUserId: null,
    topPriorityWorkflow: String(formData.get('topPriorityWorkflow') ?? '').trim(),
    departmentsInScope: parseArrayField(formData.get('departmentsInScope')),
    dataSensitivityBoundary: parseArrayField(formData.get('dataSensitivityBoundary')),
    annualBudgetEur,
    onsiteAppetite: (() => {
      const v = String(formData.get('onsiteAppetite') ?? '').trim();
      return v === '' ? null : v;
    })(),
    approvedModelRegions: parseArrayField(formData.get('approvedModelRegions')),
    dataResidency: parseArrayField(formData.get('dataResidency')),
    promptInjectionReview: (() => {
      const v = String(formData.get('promptInjectionReview') ?? '').trim();
      return v === '' ? null : v;
    })(),
    leadershipLiteracy: maturityField('leadershipLiteracy'),
    operationalAdoption: maturityField('operationalAdoption'),
    policyGovernance: maturityField('policyGovernance'),
  };
  const parsed = sponsorBriefWriteSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      message: t('intake.errInvalidInput', {
        fields: parsed.error.issues.map((i) => i.path.join('.')).join(', '),
      }),
    };
  }
  try {
    const brief = await createSponsorBrief(tenantId as TenantId, {
      sponsorUserId: parsed.data.sponsorUserId,
      topPriorityWorkflow: parsed.data.topPriorityWorkflow,
      departmentsInScope: parsed.data.departmentsInScope,
      dataSensitivityBoundary: parsed.data.dataSensitivityBoundary,
      annualBudgetEur: parsed.data.annualBudgetEur,
      onsiteAppetite: parsed.data.onsiteAppetite,
      approvedModelRegions: parsed.data.approvedModelRegions,
      dataResidency: parsed.data.dataResidency,
      promptInjectionReview: parsed.data.promptInjectionReview,
      leadershipLiteracy: parsed.data.leadershipLiteracy,
      operationalAdoption: parsed.data.operationalAdoption,
      policyGovernance: parsed.data.policyGovernance,
    });
    revalidatePath('/board');
    revalidatePath('/welcome');
    revalidatePath('/intake');
    return { ok: true, message: t('intake.saved'), briefId: brief.id };
  } catch (err) {
    // Raw error stays server-side: it may carry SQL or tenant details.
    console.error('sponsor brief save failed', err);
    return { ok: false, message: t('intake.errSaveFailed') };
  }
}
