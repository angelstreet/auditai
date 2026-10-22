'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/authServer';
import { ownedTenantIds } from '@/lib/tenantAccess';
import { SHOW_TEST_COOKIE } from '@/lib/testData';

/** Owner only: list the synthetic test organisations again, or hide them (TASK-AD2). */
export async function setShowTestDataAction(fd: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.viewAs || ownedTenantIds(session).length === 0) return;
  const on = fd.get('show') === '1';
  cookies().set(SHOW_TEST_COOKIE, on ? '1' : '0', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 31536000,
  });
  revalidatePath('/', 'layout');
}
