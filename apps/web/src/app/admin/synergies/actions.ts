'use server';

import { revalidatePath } from 'next/cache';
import {
  synergyStatusSchema,
  type SynergyId,
  type SynergyStatus,
  type TenantId,
} from '@auditai/contracts';
import { transitionSynergy } from '@/lib/synergyData';

export interface SynergyTransitionState {
  ok: boolean;
  message: string;
}

const isUuidV4 = (v: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

const SMOKE_AUDITOR_ID = '99999999-9999-4999-8999-999999999999';

export async function transitionSynergyAction(
  _prev: SynergyTransitionState,
  formData: FormData,
): Promise<SynergyTransitionState> {
  const tenantId = String(formData.get('tenantId') ?? '');
  const synergyId = String(formData.get('synergyId') ?? '');
  const nextStatusRaw = String(formData.get('nextStatus') ?? '');
  if (!isUuidV4(tenantId) || !isUuidV4(synergyId)) {
    return { ok: false, message: 'Invalid id' };
  }
  if (!synergyStatusSchema.options.includes(nextStatusRaw as SynergyStatus)) {
    return { ok: false, message: 'Invalid status' };
  }
  try {
    await transitionSynergy(
      tenantId as TenantId,
      synergyId as SynergyId,
      nextStatusRaw as SynergyStatus,
      SMOKE_AUDITOR_ID as never,
    );
    revalidatePath('/admin/synergies');
    revalidatePath('/board');
    return { ok: true, message: `Synergy now ${nextStatusRaw}` };
  } catch (err) {
    return {
      ok: false,
      message: `Transition failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
