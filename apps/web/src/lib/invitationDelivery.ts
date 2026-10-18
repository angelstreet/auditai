import type { TenantId } from '@evolai/contracts';
import { withServiceAccount } from './db';
import { decryptAddress } from './invitationCrypto';
import { SYSTEM_ACTOR, tokenFor } from './invitationData';
import {
  MAX_REMINDERS_PER_RUN,
  isReminderDue,
  parseReminderDays,
  surveyLink,
} from './invitationTracking';
import { EmailNotConfigured, resolveEmailProvider, type EmailProvider } from './emailProvider';

/**
 * Optional email delivery and the scheduled reminder pass (FR-03, ADR 0033).
 *
 * Email mode is per engagement and off by default. The address is decrypted only here, used for one
 * send, and never logged or written anywhere else. The audit trail records counts only.
 */

type Locale = 'fr' | 'en';

const COPY: Record<Locale, { invite: [string, string]; remind: [string, string] }> = {
  fr: {
    invite: [
      'Votre avis compte : questionnaire anonyme',
      'Bonjour,\n\nVous êtes invité(e) à répondre à un court questionnaire anonyme. Vos réponses ne sont jamais reliées à votre nom.\n\nVotre lien personnel : ',
    ],
    remind: [
      'Rappel : votre questionnaire anonyme',
      'Bonjour,\n\nVotre questionnaire anonyme n’est pas encore terminé. Il ne prend que quelques minutes.\n\nVotre lien personnel : ',
    ],
  },
  en: {
    invite: [
      'Your view matters: anonymous questionnaire',
      'Hello,\n\nYou are invited to answer a short anonymous questionnaire. Your answers are never linked to your name.\n\nYour personal link: ',
    ],
    remind: [
      'Reminder: your anonymous questionnaire',
      'Hello,\n\nYour anonymous questionnaire is not finished yet. It only takes a few minutes.\n\nYour personal link: ',
    ],
  },
};

export const buildMessage = (
  kind: 'invite' | 'remind',
  locale: Locale,
  to: string,
  link: string,
) => {
  const [subject, body] = COPY[locale][kind];
  return { to, subject, text: `${body}${link}\n` };
};

/** Send the first invitation mail for freshly created rows. Failures are counted, not thrown. */
export const sendInvitationEmails = async (
  baseUrl: string,
  locale: Locale,
  items: readonly { token: string; address: string }[],
  provider: EmailProvider = resolveEmailProvider(),
): Promise<{ sent: number; failed: number }> => {
  let sent = 0;
  let failed = 0;
  for (const it of items) {
    try {
      await provider.send(
        buildMessage('invite', locale, it.address, surveyLink(baseUrl, it.token)),
      );
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
};

export interface ReminderRunResult {
  readonly engagements: number;
  readonly sent: number;
  readonly failed: number;
  readonly listModeDue: number;
  readonly purged: number;
  readonly emailUnavailable: boolean;
}

interface EngagementRow {
  id: string;
  tenant_id: string;
  locale: string;
  privacy_json: Record<string, unknown>;
}

/**
 * Cron pass: email mode sends due reminders through the provider; list mode only counts what is due
 * (the client resends the list from the admin screen). Then expired and finished addresses are
 * purged. Idempotent: each reminder step is consumed when its send succeeds. Rate-limited per
 * engagement per run. Fails closed when email is wanted but the provider or key is missing.
 */
export const runReminderPass = async (
  baseUrl: string,
  now: Date = new Date(),
  providerFactory: () => EmailProvider = resolveEmailProvider,
): Promise<ReminderRunResult> => {
  const result = {
    engagements: 0,
    sent: 0,
    failed: 0,
    listModeDue: 0,
    purged: 0,
    emailUnavailable: false,
  };
  const engagements = await withServiceAccount(async (c) => {
    const { rows } = await c.query<EngagementRow>(
      `SELECT id, tenant_id, locale, privacy_json FROM engagements WHERE status = 'in_field'`,
    );
    return rows;
  });
  let provider: EmailProvider | null = null;
  for (const e of engagements) {
    result.engagements += 1;
    const schedule = parseReminderDays(e.privacy_json['reminderDays']);
    const emailMode = e.privacy_json['emailDelivery'] === true;
    const locale: Locale = e.locale === 'fr' ? 'fr' : 'en';
    if (emailMode && !provider) {
      try {
        provider = providerFactory();
      } catch (err) {
        if (!(err instanceof EmailNotConfigured)) throw err;
        result.emailUnavailable = true;
      }
    }
    await withServiceAccount(async (c) => {
      const due = (
        await c.query<{
          id: string;
          token_reference: string;
          status: string;
          created_on: string;
          expires_at: string;
          reminder_count: number;
          address_cipher: string | null;
        }>(
          `SELECT i.id, i.token_reference, i.status, i.expires_at, i.reminder_count,
                  to_char(i.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS created_on,
                  d.address_cipher
             FROM invitations i
             LEFT JOIN invitation_deliveries d ON d.invitation_id = i.id
            WHERE i.tenant_id = $1 AND i.engagement_id = $2
              AND i.status IN ('pending','opened','in_progress')
              AND i.expires_at > now() AND i.reminder_count < $3
            ORDER BY i.created_at, i.id`,
          [e.tenant_id, e.id, schedule.length],
        )
      ).rows.filter((r) =>
        isReminderDue(
          {
            status: r.status,
            createdOn: r.created_on,
            expiresAt: r.expires_at,
            reminderCount: r.reminder_count,
          },
          schedule,
          now,
        ),
      );
      if (!emailMode) {
        result.listModeDue += due.length;
        return;
      }
      if (!provider) return;
      let sent = 0;
      let failed = 0;
      for (const r of due.slice(0, MAX_REMINDERS_PER_RUN)) {
        if (!r.address_cipher) continue;
        try {
          const to = decryptAddress(r.address_cipher, r.id);
          await provider.send(
            buildMessage('remind', locale, to, surveyLink(baseUrl, tokenFor(r.token_reference))),
          );
          await c.query(
            `UPDATE invitations SET reminder_count = reminder_count + 1,
                    last_reminder_on = current_date, updated_at = now()
              WHERE id = $1 AND reminder_count = $2`,
            [r.id, r.reminder_count],
          );
          sent += 1;
        } catch {
          failed += 1;
        }
      }
      result.sent += sent;
      result.failed += failed;
      if (sent + failed > 0) {
        await c.query(
          `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
           VALUES ($1, $2, 'invitation.remind', 'engagement', $3, $4)`,
          [e.tenant_id, SYSTEM_ACTOR, e.id, JSON.stringify({ mode: 'email', sent, failed })],
        );
      }
    });
  }
  result.purged = await purgeStoredAddresses();
  return result;
};

/** Remove addresses past their purge date or whose invitation is finished, revoked or expired. */
export const purgeStoredAddresses = async (): Promise<number> =>
  withServiceAccount(async (c) => {
    const res = await c.query<{ tenant_id: string }>(
      `DELETE FROM invitation_deliveries d
        USING invitations i
        WHERE i.id = d.invitation_id
          AND (d.purge_after <= now() OR i.status NOT IN ('pending','opened','in_progress')
               OR i.expires_at <= now())
        RETURNING d.tenant_id`,
    );
    const perTenant = new Map<string, number>();
    for (const r of res.rows) perTenant.set(r.tenant_id, (perTenant.get(r.tenant_id) ?? 0) + 1);
    for (const [tenantId, n] of perTenant) {
      await c.query(
        `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
         VALUES ($1, $2, 'invitation.purge_addresses', 'engagement', $1, $3)`,
        [tenantId, SYSTEM_ACTOR, JSON.stringify({ count: n })],
      );
    }
    return res.rowCount ?? 0;
  });

export type { TenantId };
