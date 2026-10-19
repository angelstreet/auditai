'use server';

import { revalidatePath } from 'next/cache';
import { exportKindSchema } from '@evolai/contracts';
import {
  deletePseudonym,
  previewErasure,
  respondentExists,
  type ErasurePreview,
} from '@/lib/deletionData';
import { handlePrivacyRequest } from '@/lib/privacyRequests';
import type { MessageKey } from '@evolai/i18n';
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
    // Plain column names in the reader's language (the stored column names stay technical).
    const labels = new Proxy({} as Record<string, string>, {
      get: (_o, col: string) => {
        const key = `admin.setup.exportColumns.${col}` as MessageKey;
        const label = t(key);
        return label === key ? col : label;
      },
    });
    const { csv } = await runExport(who.tenantId, kindRaw as never, who.actor, labels);
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
    // An unknown code is said plainly; no green check, no erasure event for nothing.
    if (!(await respondentExists(who.tenantId, pseudonym))) {
      return { ok: false, message: t('admin.setup.data.errNoSuchRespondent') };
    }
    // The confirmation is typed by the person; a post without it is refused (belt and braces).
    if (String(formData.get('confirmCode') ?? '') !== pseudonym) {
      return { ok: false, message: t('admin.setup.data.confirmMismatch') };
    }
    const result = await deletePseudonym(who.tenantId, pseudonym, who.actor);
    revalidatePath('/admin/data');
    revalidatePath('/admin/synergies');
    revalidatePath('/admin/teams');
    return {
      ok: true,
      message: t('admin.setup.data.removedPlain', { rows: result.removedRowCount }),
    };
  } catch (err) {
    console.error('pseudonym deletion failed', err);
    return { ok: false, message: t('admin.data.errDelete') };
  }
}

export interface PreviewState {
  ok: boolean;
  message: string;
  preview?: ErasurePreview;
}

/** Count what an erasure would remove. Read only; an unknown code is said plainly. */
export async function previewErasureAction(
  _prev: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  const { t } = getT();
  const tenantId = String(formData.get('tenantId') ?? '');
  const pseudonym = String(formData.get('respondentPseudonym') ?? '');
  if (!isUuidV4(tenantId)) return { ok: false, message: t('admin.data.errInvalidTenant') };
  const who = await resolveActor(tenantId);
  if (!who.ok) return { ok: false, message: who.message };
  if (!isPseudonym(pseudonym)) return { ok: false, message: t('admin.data.errInvalidPseudonym') };
  try {
    const preview = await previewErasure(who.tenantId, pseudonym);
    if (preview.links + preview.surveys + preview.answers + preview.mascots === 0) {
      return { ok: false, message: t('admin.setup.data.errNoSuchRespondent') };
    }
    return { ok: true, message: '', preview };
  } catch (err) {
    console.error('erasure preview failed', err);
    return { ok: false, message: t('admin.data.errDelete') };
  }
}

/** Mark a privacy request as handled (clears the reply address). */
export async function handleRequestAction(
  _prev: DataActionState,
  formData: FormData,
): Promise<DataActionState> {
  const { t } = getT();
  const tenantId = String(formData.get('tenantId') ?? '');
  const id = String(formData.get('id') ?? '');
  if (!isUuidV4(tenantId)) return { ok: false, message: t('admin.data.errInvalidTenant') };
  const who = await resolveActor(tenantId);
  if (!who.ok) return { ok: false, message: who.message };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: t('admin.data.errDelete') };
  const done = await handlePrivacyRequest(who.tenantId, who.actor, id);
  revalidatePath('/admin/data');
  return done
    ? { ok: true, message: t('trust.data.handledOk') }
    : { ok: false, message: t('admin.data.errDelete') };
}
