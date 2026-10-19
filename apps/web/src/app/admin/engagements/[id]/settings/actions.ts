'use server';

import { revalidatePath } from 'next/cache';
import { resolveActor } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { isUuid } from '@/lib/invitationForm';
import { parseNoticeForm, saveNotice } from '@/lib/privacyNotice';

export interface NoticeState {
  ok: boolean;
  message: string;
}

/** Save the privacy notice fields of one engagement (TASK-U, ADR 0040). Actor from the session. */
export async function saveNoticeAction(
  _prev: NoticeState,
  formData: FormData,
): Promise<NoticeState> {
  const { t } = getT();
  const tenantId = String(formData.get('tenantId') ?? '');
  const engagementId = String(formData.get('engagementId') ?? '');
  if (!isUuid(tenantId) || !isUuid(engagementId)) {
    return { ok: false, message: t('trust.noticeForm.errFailed') };
  }
  const who = await resolveActor(tenantId);
  if (!who.ok) return { ok: false, message: who.message };
  const parsed = parseNoticeForm((k) => {
    const v = formData.get(k);
    return typeof v === 'string' ? v : null;
  });
  if (!parsed.ok) {
    return {
      ok: false,
      message: t(
        parsed.error === 'contact' ? 'trust.noticeForm.errContact' : 'trust.noticeForm.errTooLong',
      ),
    };
  }
  try {
    if (!(await saveNotice(who.tenantId, who.actor, engagementId, parsed.value))) {
      return { ok: false, message: t('trust.noticeForm.errFailed') };
    }
    revalidatePath(`/admin/engagements/${engagementId}/settings`);
    return { ok: true, message: t('trust.noticeForm.saved') };
  } catch (err) {
    console.error('notice save failed', err);
    return { ok: false, message: t('trust.noticeForm.errFailed') };
  }
}
