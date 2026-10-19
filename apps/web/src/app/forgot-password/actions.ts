'use server';

import { headers } from 'next/headers';
import { createTranslator } from '@evolai/i18n';
import { auditSelf } from '@/lib/authAudit';
import { emailHash } from '@/lib/authProvider';
import { issueToken } from '@/lib/authTokens';
import { withServiceAccount } from '@/lib/db';
import { resolveEmailProvider } from '@/lib/emailProvider';
import { getT, getLocale } from '@/lib/i18n';
import { isPlausibleEmail } from '@/lib/invitationCrypto';
import { resolveBaseUrl } from '@/lib/invitationTracking';
import { clientAddress } from '@/lib/loginThrottle';
import { hitPublicLimit } from '@/lib/publicThrottle';

export interface ForgotState {
  ok: boolean;
  message: string;
}

/**
 * Ask for a reset link. The answer is the same whether the address exists, is disabled, or the
 * caller is rate limited, so the form cannot be used to find out who has an account (TASK-U).
 * The address is only used to look the person up and to send the email; it is never stored.
 */
export async function forgotPasswordAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const { t } = getT();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!isPlausibleEmail(email)) return { ok: false, message: t('trust.referents.errEmail') };
  const same: ForgotState = { ok: true, message: t('trust.forgot.done') };
  const h = headers();
  if (await hitPublicLimit('forgot_password', email, clientAddress(h))) return same;
  const userId = await withServiceAccount(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `SELECT u.id FROM users u
        WHERE u.email_hash = $1 AND u.disabled_at IS NULL AND u.password_hash IS NOT NULL
          AND EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id)`,
      [emailHash(email)],
    );
    return rows[0]?.id ?? null;
  });
  if (!userId) return same;
  const { token } = await withServiceAccount((client) => issueToken(client, userId, 'reset'));
  let emailed = false;
  try {
    const base = resolveBaseUrl(process.env, h.get('host'), h.get('x-forwarded-proto'));
    const tr = createTranslator(getLocale());
    await resolveEmailProvider().send({
      to: email,
      subject: tr('trust.email.resetSubject'),
      text: tr('trust.email.resetBody', { link: `${base}/set-password?token=${token}` }),
    });
    emailed = true;
  } catch {
    // No provider configured or it refused: the owner can create a link by hand (RUNBOOK).
  }
  await auditSelf(userId, 'password.reset_request', { emailed });
  return same;
}
