import type { TenantId, UserId } from '@evolai/contracts';
import { withServiceAccount, withTenant } from './db';
import { isPlausibleEmail } from './invitationCrypto';

/**
 * Withdraw / erase / question requests from the public privacy page (TASK-U, ADR 0039). They go to
 * the auditor's data page, never to a manager. No name is collected; the optional reply address is
 * cleared once the request is handled.
 */
export type RequestKind = 'withdraw' | 'erase' | 'question';
export const REQUEST_KINDS: readonly RequestKind[] = ['withdraw', 'erase', 'question'];

export interface RequestInput {
  readonly engagementId: string;
  readonly kind: RequestKind;
  readonly code: string;
  readonly message: string;
  readonly replyTo: string;
}

const CODE_RE = /^[A-Za-z0-9-]{0,64}$/;

/** Clean the public form values; null when anything is off. */
export const parseRequest = (
  get: (name: string) => string | null,
): RequestInput | null => {
  const kind = (get('kind') ?? '') as RequestKind;
  const code = (get('code') ?? '').trim();
  const message = (get('message') ?? '').trim();
  const replyTo = (get('replyTo') ?? '').trim();
  if (!REQUEST_KINDS.includes(kind)) return null;
  if (!CODE_RE.test(code) || message.length > 1000) return null;
  if (replyTo && !isPlausibleEmail(replyTo)) return null;
  // An erase request needs something to act on: a code or a message.
  if (kind !== 'question' && !code && !message) return null;
  return { engagementId: get('engagementId') ?? '', kind, code, message, replyTo };
};

/** Store a request for the engagement's organisation. False when the engagement is unknown. */
export const createPrivacyRequest = async (input: RequestInput): Promise<boolean> =>
  withServiceAccount(async (client) => {
    const eng = await client.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM engagements WHERE id = $1`,
      [input.engagementId],
    );
    const tenantId = eng.rows[0]?.tenant_id;
    if (!tenantId) return false;
    await client.query(
      `INSERT INTO privacy_requests (tenant_id, engagement_id, kind, respondent_code, message, reply_to)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tenantId,
        input.engagementId,
        input.kind,
        input.code || null,
        input.message || null,
        input.replyTo || null,
      ],
    );
    return true;
  });

export interface PrivacyRequestRow {
  readonly id: string;
  readonly kind: RequestKind;
  readonly code: string | null;
  readonly message: string | null;
  readonly replyTo: string | null;
  readonly status: 'open' | 'handled';
  readonly createdAt: string;
}

export const listPrivacyRequests = async (
  tenantId: TenantId,
): Promise<PrivacyRequestRow[]> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      id: string;
      kind: RequestKind;
      respondent_code: string | null;
      message: string | null;
      reply_to: string | null;
      status: 'open' | 'handled';
      created_at: Date | string;
    }>(
      `SELECT id, kind, respondent_code, message, reply_to, status, created_at
         FROM privacy_requests WHERE tenant_id = $1
        ORDER BY (status = 'open') DESC, created_at DESC LIMIT 50`,
      [tenantId],
    );
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      code: r.respondent_code,
      message: r.message,
      replyTo: r.reply_to,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  });

export const handlePrivacyRequest = async (
  tenantId: TenantId,
  actor: UserId,
  id: string,
): Promise<boolean> =>
  withTenant(tenantId, async (client) => {
    const res = await client.query(
      `UPDATE privacy_requests SET status = 'handled', handled_at = now(), reply_to = NULL
        WHERE tenant_id = $1 AND id = $2 AND status = 'open'`,
      [tenantId, id],
    );
    if (res.rowCount === 0) return false;
    await client.query(
      `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
       VALUES ($1, $2, 'privacy_request.handle', 'privacy_request', $3, '{}'::jsonb)`,
      [tenantId, actor, id],
    );
    return true;
  });
