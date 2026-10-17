'use server';

import { revalidatePath } from 'next/cache';
import { exportKindSchema, type TenantId, type UserId } from '@auditai/contracts';
import { deletePseudonym, listDeletionEvents } from '@/lib/deletionData';
import { listExportRequests, runExport } from '@/lib/exportData';

export interface DataActionState {
  ok: boolean;
  message: string;
  /** When the action emits a CSV, this carries the body and the file name. */
  csv?: { filename: string; body: string };
}

const isUuidV4 = (v: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const isPseudonym = (v: string): boolean => /^[a-z0-9-]{8,64}$/.test(v);

const SMOKE_AUDITOR_ID = '99999999-9999-4999-8999-999999999999';

export async function triggerExportAction(
  _prev: DataActionState,
  formData: FormData,
): Promise<DataActionState> {
  const tenantId = String(formData.get('tenantId') ?? '');
  const kindRaw = String(formData.get('kind') ?? '');
  if (!isUuidV4(tenantId)) return { ok: false, message: 'Invalid tenant id' };
  if (!exportKindSchema.options.includes(kindRaw as never)) {
    return { ok: false, message: 'Invalid export kind' };
  }
  try {
    const { csv } = await runExport(
      tenantId as TenantId,
      kindRaw as never,
      SMOKE_AUDITOR_ID as UserId,
    );
    revalidatePath('/admin/data');
    return {
      ok: true,
      message: `Exported ${kindRaw}`,
      csv: { filename: `auditai-${kindRaw}.csv`, body: csv },
    };
  } catch (err) {
    return {
      ok: false,
      message: `Export failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function triggerDeletePseudonymAction(
  _prev: DataActionState,
  formData: FormData,
): Promise<DataActionState> {
  const tenantId = String(formData.get('tenantId') ?? '');
  const pseudonym = String(formData.get('respondentPseudonym') ?? '');
  if (!isUuidV4(tenantId)) return { ok: false, message: 'Invalid tenant id' };
  if (!isPseudonym(pseudonym)) return { ok: false, message: 'Invalid pseudonym' };
  try {
    const result = await deletePseudonym(
      tenantId as TenantId,
      pseudonym,
      SMOKE_AUDITOR_ID as UserId,
    );
    revalidatePath('/admin/data');
    revalidatePath('/admin/synergies');
    revalidatePath('/admin/teams');
    return {
      ok: true,
      message: `Removed ${result.removedRowCount} row(s); wrote ${result.events.length} deletion_events`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Deletion failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export { listDeletionEvents, listExportRequests };
