'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { resolveActor } from '@/lib/authServer';
import { isUuid } from '@/lib/invitationForm';
import {
  changeEngagementStatus,
  createEngagement,
  createTeam,
  updateEngagement,
  updateTeam,
} from '@/lib/setupData';
import { SetupError, parseEngagementForm, parseName, parseTeamSize } from '@/lib/setupForm';
import type { SetupActionState } from './state';

/**
 * Audit set-up actions (TASK-T, ADR 0038). The actor and the tenant come from the session
 * (`resolveActor`: signed in, member of the tenant, never inside a view-as); the form's tenant id is
 * only a selector. Every data-layer call writes its own audit row. Results are codes the page words.
 */

const codeOf = (err: unknown): string => {
  if (err instanceof SetupError) return err.code;
  console.error('set-up action failed', err instanceof Error ? err.name : 'unknown');
  return 'error';
};

const guard = async (fd: FormData) => {
  const tenantId = String(fd.get('tenantId') ?? '');
  if (!isUuid(tenantId)) return { ok: false as const, code: 'forbidden' };
  const who = await resolveActor(tenantId);
  return who.ok ? { ok: true as const, who } : { ok: false as const, code: 'forbidden' };
};

export async function createEngagementAction(
  _prev: SetupActionState,
  fd: FormData,
): Promise<SetupActionState> {
  const g = await guard(fd);
  if (!g.ok) return { ok: false, code: g.code };
  let id: string;
  try {
    id = await createEngagement(g.who.tenantId, g.who.actor, parseEngagementForm(fd));
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
  revalidatePath('/admin/engagements');
  redirect(`/admin/engagements/${id}/settings?tenant=${g.who.tenantId}&done=created`);
}

export async function updateEngagementAction(
  _prev: SetupActionState,
  fd: FormData,
): Promise<SetupActionState> {
  const g = await guard(fd);
  const engagementId = String(fd.get('engagementId') ?? '');
  if (!g.ok || !isUuid(engagementId)) return { ok: false, code: 'forbidden' };
  try {
    await updateEngagement(g.who.tenantId, g.who.actor, engagementId, parseEngagementForm(fd));
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
  revalidatePath('/admin', 'layout');
  return { ok: true, code: 'saved' };
}

export async function changeStatusAction(
  _prev: SetupActionState,
  fd: FormData,
): Promise<SetupActionState> {
  const g = await guard(fd);
  const engagementId = String(fd.get('engagementId') ?? '');
  const change = String(fd.get('change') ?? '');
  if (!g.ok || !isUuid(engagementId)) return { ok: false, code: 'forbidden' };
  if (change !== 'launch' && change !== 'close') return { ok: false, code: 'bad_status' };
  // Launching and closing are deliberate: the dialog sends the confirmation, a bare post is refused.
  if (fd.get('confirm') !== 'yes') return { ok: false, code: 'confirm_required' };
  try {
    await changeEngagementStatus(g.who.tenantId, g.who.actor, engagementId, change);
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
  revalidatePath('/admin', 'layout');
  return { ok: true, code: change === 'launch' ? 'launched' : 'closed' };
}

export async function createTeamAction(
  _prev: SetupActionState,
  fd: FormData,
): Promise<SetupActionState> {
  const g = await guard(fd);
  if (!g.ok) return { ok: false, code: g.code };
  const name = parseName(fd.get('name'));
  const size = parseTeamSize(fd.get('expectedHeadcount'));
  if (!name) return { ok: false, code: 'bad_name' };
  if (size === null) return { ok: false, code: 'bad_size' };
  try {
    await createTeam(g.who.tenantId, g.who.actor, { name, expectedHeadcount: size });
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
  revalidatePath('/admin', 'layout');
  return { ok: true, code: 'team_created' };
}

export async function updateTeamAction(
  _prev: SetupActionState,
  fd: FormData,
): Promise<SetupActionState> {
  const g = await guard(fd);
  const teamId = String(fd.get('teamId') ?? '');
  if (!g.ok || !isUuid(teamId)) return { ok: false, code: 'forbidden' };
  const name = parseName(fd.get('name'));
  const size = parseTeamSize(fd.get('expectedHeadcount'));
  if (!name) return { ok: false, code: 'bad_name' };
  if (size === null) return { ok: false, code: 'bad_size' };
  try {
    await updateTeam(g.who.tenantId, g.who.actor, teamId, { name, expectedHeadcount: size });
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
  revalidatePath('/admin', 'layout');
  return { ok: true, code: 'team_saved' };
}
