'use server';

import { revalidatePath } from 'next/cache';
import { exportKindSchema } from '@evolai/contracts';
import { deletePseudonym } from '@/lib/deletionData';
import { runExport } from '@/lib/exportData';
import { resolveActor } from '@/lib/authServer';
import { enumLabel, getT } from '@/lib/i18n';

export interface DataActionState {
  ok: boolean;
  message: string;
  /** When the action emits a CSV, this carries the body and the file name. */
  csv?: { filename: string; body: string };
}

const isUuidV4 = (v: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const isPseudonym = (v: string): boolean => /^[a-z0-9-]{8,64}$/.test(v);

export async function triggerExportAction(
  _prev: DataActionState,
  formData: FormData,
): Promise<DataActionState> {
  const { t } = getT();
  const tenantId = String(formData.get('tenantId') ?? '');
  const kindRaw = String(formData.get('kind') ?? '');
  if (!isUuidV4(tenantId)) return { ok: false, message: t('admin.data.errInvalidTenant') };
  const who = await resolveActor(tenantId);
  if (!who.ok) return { ok: false, message: who.message };
  if (!exportKindSchema.options.includes(kindRaw as never)) {
    return { ok: false, message: t('admin.data.errInvalidKind') };
  }
  try {
    const { csv } = await runExport(who.tenantId, kindRaw as never, who.actor);
    revalidatePath('/admin/data');
    return {
      ok: true,
      message: t('admin.data.exported', { kind: enumLabel(t, 'exportKind', kindRaw) }),
      csv: { filename: `evolai-${kindRaw}.csv`, body: csv },
    };
  } catch (err) {
    console.error('export failed', err);
    return { ok: false, message: t('admin.data.errExport') };
  }
}

export async function triggerDeletePseudonymAction(
  _prev: DataActionState,
  formData: FormData,
): Promise<DataActionState> {
  const { t } = getT();
  const tenantId = String(formData.get('tenantId') ?? '');
  const pseudonym = String(formData.get('respondentPseudonym') ?? '');
  if (!isUuidV4(tenantId)) return { ok: false, message: t('admin.data.errInvalidTenant') };
  const who = await resolveActor(tenantId);
  if (!who.ok) return { ok: false, message: who.message };
  if (!isPseudonym(pseudonym)) return { ok: false, message: t('admin.data.errInvalidPseudonym') };
  try {
    const result = await deletePseudonym(who.tenantId, pseudonym, who.actor);
    revalidatePath('/admin/data');
    revalidatePath('/admin/synergies');
    revalidatePath('/admin/teams');
    return {
      ok: true,
      message: t('admin.data.removed', {
        rows: result.removedRowCount,
        events: result.events.length,
      }),
    };
  } catch (err) {
    console.error('pseudonym deletion failed', err);
    return { ok: false, message: t('admin.data.errDelete') };
  }
}
