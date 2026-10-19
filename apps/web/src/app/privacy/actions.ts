'use server';

import { headers } from 'next/headers';
import { createTranslator } from '@evolai/i18n';
import { resolveEmailProvider } from '@/lib/emailProvider';
import { getLocale, getT } from '@/lib/i18n';
import { clientAddress } from '@/lib/loginThrottle';
import { getPublicNotice } from '@/lib/privacyNotice';
import { createPrivacyRequest, parseRequest } from '@/lib/privacyRequests';
import { hitPublicLimit } from '@/lib/publicThrottle';

export interface RequestState {
  ok: boolean;
  message: string;
}

/**
 * Public request to withdraw, erase or ask (TASK-U, ADR 0040). It goes to the auditor's data page;
 * a manager never sees it. Rate limited per address and per reply email.
 */
export async function submitPrivacyRequestAction(
  _prev: RequestState,
  formData: FormData,
): Promise<RequestState> {
  const { t } = getT();
  const input = parseRequest((k) => {
    const v = formData.get(k);
    return typeof v === 'string' ? v : null;
  });
  if (!input) return { ok: false, message: t('trust.notice.errInvalid') };
  const h = headers();
  if (
    await hitPublicLimit('privacy_request', input.replyTo || input.code || 'none', clientAddress(h))
  ) {
    return { ok: false, message: t('trust.notice.errTooMany') };
  }
  try {
    if (!(await createPrivacyRequest(input))) {
      return { ok: false, message: t('trust.notice.errInvalid') };
    }
    // Best effort: tell the privacy contact that something is waiting. No content in the email.
    const found = await getPublicNotice(input.engagementId);
    const to = found?.notice.contactEmail;
    if (to) {
      try {
        const tr = createTranslator(getLocale());
        await resolveEmailProvider().send({
          to,
          subject: tr('trust.email.requestSubject'),
          text: tr('trust.email.requestBody'),
        });
      } catch {
        // No provider configured: the request is on the data page anyway.
      }
    }
    return { ok: true, message: t('trust.notice.sent') };
  } catch (err) {
    console.error('privacy request failed', err);
    return { ok: false, message: t('trust.notice.errFailed') };
  }
}
