'use server';

import { headers } from 'next/headers';
import { createTranslator } from '@evolai/i18n';
import { resolveActor } from '@/lib/authServer';
import { resolveEmailProvider } from '@/lib/emailProvider';
import { getLocale, getT } from '@/lib/i18n';
import { isPlausibleEmail } from '@/lib/invitationCrypto';
import { isUuid } from '@/lib/invitationForm';
import { resolveBaseUrl } from '@/lib/invitationTracking';
import { inviteReferent } from '@/lib/referentData';

export interface InviteState {
  ok: boolean;
  message: string;
  link?: string;
  emailed?: boolean;
}

/** Owner action: create a sign-in link for one referent (TASK-U, ADR 0039). Actor from the session. */
export async function inviteReferentAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const { t } = getT();
  const tenantId = String(formData.get('tenantId') ?? '');
  const userId = String(formData.get('userId') ?? '');
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!isUuid(tenantId) || !isUuid(userId)) {
    return { ok: false, message: t('trust.referents.errNotReferent') };
  }
  const who = await resolveActor(tenantId);
  if (!who.ok) return { ok: false, message: who.message };
  if (email && !isPlausibleEmail(email))
    return { ok: false, message: t('trust.referents.errEmail') };
  try {
    const res = await inviteReferent(who.tenantId, who.actor, userId, email || null);
    if (!res.ok) {
      const key = {
        not_referent: 'trust.referents.errNotReferent',
        disabled: 'trust.referents.errDisabled',
        taken: 'trust.referents.errTaken',
      } as const;
      return { ok: false, message: t(key[res.reason]) };
    }
    const h = headers();
    const link = `${resolveBaseUrl(process.env, h.get('host'), h.get('x-forwarded-proto'))}/set-password?token=${res.token}`;
    let emailed = false;
    if (email) {
      try {
        const tr = createTranslator(getLocale());
        await resolveEmailProvider().send({
          to: email,
          subject: tr('trust.email.inviteSubject'),
          text: tr('trust.email.inviteBody', { link }),
        });
        emailed = true;
      } catch {
        // No provider configured: the owner copies the link instead.
      }
    }
    return { ok: true, message: t('trust.referents.sendYourself'), link, emailed };
  } catch (err) {
    console.error('referent invite failed', err);
    return { ok: false, message: t('trust.referents.errFailed') };
  }
}
