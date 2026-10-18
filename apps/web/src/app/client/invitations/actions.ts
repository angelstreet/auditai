'use server';

import { revalidatePath } from 'next/cache';
import { createClientLinks, type ClientActionState } from '@/lib/clientActions';

/** Server action behind the team space "Create links" form (TASK-P). */
export async function createClientLinksAction(
  _prev: ClientActionState,
  fd: FormData,
): Promise<ClientActionState> {
  const out = await createClientLinks(fd);
  if (out.ok) revalidatePath('/client/invitations');
  return out;
}
