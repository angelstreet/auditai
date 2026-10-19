'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { loadMemberships } from '@/lib/authProvider';
import { auditSelf } from '@/lib/authAudit';
import { setPasswordWithToken } from '@/lib/authTokens';
import { getT } from '@/lib/i18n';
import {
  SESSION_COOKIE,
  newSessionPayload,
  sessionCookieOptions,
  signSession,
} from '@/lib/session';
import { ADMIN_ROLES, CLIENT_ROLES } from '@/lib/tenantAccess';

export interface SetPasswordState {
  message: string;
  /** True when the link itself is dead, so the form should give way to the "ask again" message. */
  dead?: boolean;
}

/**
 * Spend the link, set the password, sign the person in and send them to their own surface: a
 * referent to /client, staff to /board (TASK-U, ADR 0039).
 */
export async function setPasswordAction(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const { t } = getT();
  const result = await setPasswordWithToken(
    String(formData.get('token') ?? ''),
    String(formData.get('password') ?? ''),
    String(formData.get('again') ?? ''),
  );
  if (!result.ok) {
    if (result.reason === 'invalid') {
      return { message: t('trust.setPassword.errInvalid'), dead: true };
    }
    const key = {
      too_short: 'trust.setPassword.errShort',
      too_long: 'trust.setPassword.errLong',
      mismatch: 'trust.setPassword.errMismatch',
    } as const;
    return { message: t(key[result.reason]) };
  }
  const memberships = await loadMemberships(result.userId);
  const staff = memberships.some((m) => ADMIN_ROLES.has(m.role));
  const referent = memberships.some((m) => CLIENT_ROLES.has(m.role) && m.teamId);
  if (!staff && !referent) return { message: t('trust.setPassword.errInvalid'), dead: true };
  await auditSelf(result.userId, result.kind === 'invite' ? 'password.set' : 'password.reset');
  const token = await signSession(
    newSessionPayload({ id: result.userId, name: result.displayName }, memberships),
  );
  cookies().set(SESSION_COOKIE, token, sessionCookieOptions());
  redirect(staff ? '/board' : '/client');
}
