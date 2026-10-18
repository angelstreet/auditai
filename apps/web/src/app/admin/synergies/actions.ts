'use server';

import { revalidatePath } from 'next/cache';
import { synergyStatusSchema, type SynergyId, type SynergyStatus } from '@evolai/contracts';
import { transitionSynergy } from '@/lib/synergyData';
import { resolveActor } from '@/lib/authServer';
import { enumLabel, getT } from '@/lib/i18n';

export interface SynergyTransitionState {
  ok: boolean;
  message: string;
}

const isUuidV4 = (v: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export async function transitionSynergyAction(
  _prev: SynergyTransitionState,
  formData: FormData,
): Promise<SynergyTransitionState> {
  const { t } = getT();
  const tenantId = String(formData.get('tenantId') ?? '');
  const synergyId = String(formData.get('synergyId') ?? '');
  const nextStatusRaw = String(formData.get('nextStatus') ?? '');
  if (!isUuidV4(tenantId) || !isUuidV4(synergyId)) {
    return { ok: false, message: t('admin.synergies.errInvalidId') };
  }
  const who = await resolveActor(tenantId);
  if (!who.ok) return { ok: false, message: who.message };
  if (!synergyStatusSchema.options.includes(nextStatusRaw as SynergyStatus)) {
    return { ok: false, message: t('admin.synergies.errInvalidStatus') };
  }
  try {
    await transitionSynergy(
      who.tenantId,
      synergyId as SynergyId,
      nextStatusRaw as SynergyStatus,
      who.actor,
    );
    revalidatePath('/admin/synergies');
    revalidatePath('/board');
    return {
      ok: true,
      message: t('admin.synergies.nowStatus', {
        status: enumLabel(t, 'synergyStatus', nextStatusRaw),
      }),
    };
  } catch (err) {
    console.error('synergy transition failed', err);
    return { ok: false, message: t('admin.synergies.errTransition') };
  }
}
