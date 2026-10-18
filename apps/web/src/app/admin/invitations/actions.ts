'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { resolveActor } from '@/lib/authServer';
import {
  InvitationError,
  createBatch,
  extend,
  markReminded,
  regenerate,
  revoke,
  updateSettings,
} from '@/lib/invitationData';
import { sendInvitationEmails } from '@/lib/invitationDelivery';
import { MissingEmailKey } from '@/lib/invitationCrypto';
import { EmailNotConfigured, resolveEmailProvider } from '@/lib/emailProvider';
import { isUuid, parseCreateForm } from '@/lib/invitationForm';
import type { InviteActionState } from './state';
import { parseReminderDays, resolveBaseUrl } from '@/lib/invitationTracking';

/**
 * Admin actions for FR-03. The actor and the tenant always come from the session
 * (`resolveActor`); the form's tenant id is only a selector. Results are codes, mapped to words by
 * the page, so no address or link ever travels back in an error message.
 */

const baseUrl = (): string => {
  const h = headers();
  return resolveBaseUrl(
    process.env,
    h.get('x-forwarded-host') ?? h.get('host'),
    h.get('x-forwarded-proto'),
  );
};

const codeOf = (err: unknown): string => {
  if (err instanceof InvitationError) return err.code;
  if (err instanceof EmailNotConfigured) return 'email_not_configured';
  if (err instanceof MissingEmailKey) return 'email_key_missing';
  console.error('invitation action failed', err instanceof Error ? err.name : 'unknown');
  return 'error';
};

const guard = async (fd: FormData) => {
  const tenantId = String(fd.get('tenantId') ?? '');
  const engagementId = String(fd.get('engagementId') ?? '');
  if (!isUuid(tenantId) || !isUuid(engagementId)) return null;
  const who = await resolveActor(tenantId);
  return who.ok ? { who, engagementId } : null;
};

export async function createInvitationsAction(
  _prev: InviteActionState,
  fd: FormData,
): Promise<InviteActionState> {
  const g = await guard(fd);
  if (!g) return { ok: false, code: 'forbidden' };
  const parsed = parseCreateForm(fd);
  if (!parsed.ok) return { ok: false, code: parsed.error };
  try {
    if (parsed.addresses.length > 0) {
      // Fail closed before anything is written: key and provider must both be available.
      resolveEmailProvider();
      const { resolveEmailKey } = await import('@/lib/invitationCrypto');
      resolveEmailKey();
    }
    const out = await createBatch({
      tenantId: g.who.tenantId,
      engagementId: g.engagementId,
      actor: g.who.actor,
      groups: parsed.groups,
      addresses: parsed.addresses,
      expiresInDays: parsed.expiresInDays,
    });
    let emailSent = 0;
    let emailFailed = 0;
    if (out.deliveries.length > 0) {
      const byId = new Map(out.invitations.map((i) => [i.id, i.token]));
      const { getSettings } = await import('@/lib/invitationData');
      const settings = await getSettings(g.who.tenantId, g.engagementId);
      const res = await sendInvitationEmails(
        baseUrl(),
        settings?.locale ?? 'fr',
        out.deliveries.map((d) => ({ token: byId.get(d.id) as string, address: d.address })),
      );
      emailSent = res.sent;
      emailFailed = res.failed;
    }
    revalidatePath('/admin/invitations');
    return { ok: true, code: 'created', count: out.invitations.length, emailSent, emailFailed };
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
}

export async function updateInvitationSettingsAction(
  _prev: InviteActionState,
  fd: FormData,
): Promise<InviteActionState> {
  const g = await guard(fd);
  if (!g) return { ok: false, code: 'forbidden' };
  const days = String(fd.get('reminderDays') ?? '')
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);
  const reminderDays = parseReminderDays(days);
  try {
    await updateSettings(g.who.tenantId, g.engagementId, g.who.actor, {
      emailDelivery: fd.get('emailDelivery') === 'on',
      reminderDays,
    });
    revalidatePath('/admin/invitations');
    return { ok: true, code: 'saved' };
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
}

export async function markRemindedAction(
  _prev: InviteActionState,
  fd: FormData,
): Promise<InviteActionState> {
  const g = await guard(fd);
  if (!g) return { ok: false, code: 'forbidden' };
  try {
    const count = await markReminded(g.who.tenantId, g.engagementId, g.who.actor);
    revalidatePath('/admin/invitations');
    return { ok: true, code: 'reminded', count };
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
}

type PerInvitation = 'revoke' | 'extend' | 'regenerate';

export async function invitationOperationAction(
  _prev: InviteActionState,
  fd: FormData,
): Promise<InviteActionState> {
  const g = await guard(fd);
  const invitationId = String(fd.get('invitationId') ?? '');
  const op = String(fd.get('op') ?? '') as PerInvitation;
  if (!g || !isUuid(invitationId)) return { ok: false, code: 'forbidden' };
  try {
    if (op === 'revoke') await revoke(g.who.tenantId, invitationId, g.who.actor);
    else if (op === 'extend') {
      await extend(g.who.tenantId, invitationId, g.who.actor, Number(fd.get('days') ?? 7));
    } else if (op === 'regenerate') {
      const link = await regenerate(g.who.tenantId, invitationId, g.who.actor, baseUrl());
      revalidatePath('/admin/invitations');
      return { ok: true, code: 'regenerated', link };
    } else return { ok: false, code: 'error' };
    revalidatePath('/admin/invitations');
    return { ok: true, code: op === 'revoke' ? 'revoked' : 'extended' };
  } catch (err) {
    return { ok: false, code: codeOf(err) };
  }
}
