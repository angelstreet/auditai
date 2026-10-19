'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALE_COOKIE, isSupportedLocale } from '@evolai/i18n';

/**
 * Language switch (TASK-T, ADR 0038): the cookie is set on the server and the layout re-rendered in
 * the same round trip, so the page never shows the old language between the click and the refresh.
 */
export async function setLocaleAction(next: string): Promise<void> {
  if (!isSupportedLocale(next)) return;
  cookies().set(LOCALE_COOKIE, next, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  revalidatePath('/', 'layout');
}
