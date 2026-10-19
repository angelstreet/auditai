import type { TenantId, UserId } from '@evolai/contracts';
import { withServiceAccount, withTenant } from './db';
import { isPlausibleEmail } from './invitationCrypto';

/**
 * Privacy notice fields per engagement (TASK-U, ADR 0039). They live in `engagements.privacy_json`
 * under `notice`, so no migration is needed. The public page and the first survey page read the
 * same resolved values; a part that is not configured is hidden, never shown empty.
 */
export type LegalBasis = 'consent' | 'legitimate_interest';

export interface NoticeInput {
  readonly controller: string;
  readonly contactName: string;
  readonly contactEmail: string;
  readonly purpose: string;
  readonly basis: LegalBasis;
  readonly providers: readonly string[];
  readonly region: string;
  readonly aiOn: boolean;
  readonly aiRoute: string;
}

export type NoticeGap = 'contact' | 'providers' | 'retention' | 'ai';

export interface ResolvedNotice {
  readonly controller: string;
  readonly contact: string | null;
  readonly purpose: string | null;
  readonly basis: LegalBasis;
  readonly providers: readonly string[];
  readonly region: string | null;
  /** Set only when AI analysis is on AND an approved service is named (fail closed). */
  readonly aiRoute: string | null;
  readonly retentionDays: number | null;
  /** Parts the public page hides until configured. */
  readonly gaps: readonly NoticeGap[];
}

export interface NoticeContext {
  readonly organisation: string;
  readonly retentionDays: number | null;
  readonly dataRegion: string | null;
}

const LIMITS = { short: 160, long: 600, providers: 12 } as const;

const str = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Stored `notice` object (any shape) plus context to the values the pages show. */
export const resolveNotice = (privacyJson: unknown, ctx: NoticeContext): ResolvedNotice => {
  const pj = (privacyJson && typeof privacyJson === 'object' ? privacyJson : {}) as Record<
    string,
    unknown
  >;
  const n = (pj['notice'] && typeof pj['notice'] === 'object' ? pj['notice'] : {}) as Record<
    string,
    unknown
  >;
  const contactName = str(n['contactName'], LIMITS.short);
  const contactEmail = str(n['contactEmail'], 320);
  // Older engagements kept one free-text contact (`respondentContact`, ADR 0033).
  const legacy = str(pj['respondentContact'], LIMITS.short);
  const contact = [contactName, contactEmail].filter(Boolean).join(', ') || legacy || null;
  const providers = Array.isArray(n['providers'])
    ? n['providers']
        .map((p) => str(p, LIMITS.short))
        .filter(Boolean)
        .slice(0, LIMITS.providers)
    : [];
  const region = str(n['region'], LIMITS.short) || ctx.dataRegion || null;
  const aiOn = n['aiOn'] === true;
  const aiRoute = aiOn ? str(n['aiRoute'], LIMITS.short) || null : null;
  const gaps: NoticeGap[] = [];
  if (!contact) gaps.push('contact');
  if (providers.length === 0) gaps.push('providers');
  if (ctx.retentionDays === null) gaps.push('retention');
  if (aiOn && !aiRoute) gaps.push('ai');
  return {
    controller: str(n['controller'], LIMITS.short) || ctx.organisation,
    contact,
    purpose: str(n['purpose'], LIMITS.long) || null,
    basis: n['basis'] === 'legitimate_interest' ? 'legitimate_interest' : 'consent',
    providers,
    region,
    aiRoute,
    retentionDays: ctx.retentionDays,
    gaps,
  };
};

export type NoticeFormError = 'contact' | 'too_long';

/** Form fields to a clean input, or the first error. Pure, so the action and tests share it. */
export const parseNoticeForm = (
  get: (name: string) => string | null,
): { ok: true; value: NoticeInput } | { ok: false; error: NoticeFormError } => {
  const raw = (k: string): string => (get(k) ?? '').trim();
  const limits: Array<[string, number]> = [
    ['controller', LIMITS.short],
    ['contactName', LIMITS.short],
    ['purpose', LIMITS.long],
    ['region', LIMITS.short],
    ['aiRoute', LIMITS.short],
  ];
  for (const [k, max] of limits) if (raw(k).length > max) return { ok: false, error: 'too_long' };
  const providerLines = (get('providers') ?? '')
    .split(/\r?\n/)
    .map((l) => str(l, LIMITS.short + 1))
    .filter(Boolean);
  if (
    providerLines.length > LIMITS.providers ||
    providerLines.some((p) => p.length > LIMITS.short)
  ) {
    return { ok: false, error: 'too_long' };
  }
  const contactEmail = raw('contactEmail');
  if (contactEmail && !isPlausibleEmail(contactEmail)) return { ok: false, error: 'contact' };
  return {
    ok: true,
    value: {
      controller: raw('controller'),
      contactName: raw('contactName'),
      contactEmail,
      purpose: raw('purpose'),
      basis: raw('basis') === 'legitimate_interest' ? 'legitimate_interest' : 'consent',
      providers: providerLines,
      region: raw('region'),
      aiOn: raw('aiOn') === 'on',
      aiRoute: raw('aiRoute'),
    },
  };
};

interface EngagementNoticeRow {
  privacy_json: unknown;
  retention_days: number | null;
  data_region: string | null;
  organisation: string | null;
  tenant_id: string;
}

const NOTICE_SQL = `
  SELECT e.privacy_json, e.tenant_id, t.retention_days, t.data_region,
         (SELECT COALESCE(o.trading_name, o.legal_name) FROM organisations o
           WHERE o.tenant_id = e.tenant_id ORDER BY o.created_at, o.id LIMIT 1) AS organisation
    FROM engagements e JOIN tenants t ON t.id = e.tenant_id
   WHERE e.id = $1`;

const toResolved = (row: EngagementNoticeRow): ResolvedNotice =>
  resolveNotice(row.privacy_json, {
    organisation: row.organisation ?? '',
    retentionDays: row.retention_days,
    dataRegion: row.data_region,
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public read: only the resolved notice fields and the organisation, nothing else of the engagement. */
export const getPublicNotice = async (
  engagementId: string,
): Promise<{ notice: ResolvedNotice; tenantId: string } | null> => {
  if (!UUID_RE.test(engagementId)) return null;
  return withServiceAccount(async (client) => {
    const { rows } = await client.query<EngagementNoticeRow>(NOTICE_SQL, [engagementId]);
    const row = rows[0];
    return row ? { notice: toResolved(row), tenantId: row.tenant_id } : null;
  });
};

/** Admin read: the stored (unresolved) input for the form, plus the resolved view for warnings. */
export const getNoticeForAdmin = async (
  tenantId: TenantId,
  engagementId: string,
): Promise<{
  stored: Partial<NoticeInput>;
  resolved: ResolvedNotice;
  organisation: string;
} | null> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<EngagementNoticeRow>(`${NOTICE_SQL} AND e.tenant_id = $2`, [
      engagementId,
      tenantId,
    ]);
    const row = rows[0];
    if (!row) return null;
    const pj = (row.privacy_json ?? {}) as Record<string, unknown>;
    const stored = ((pj['notice'] ?? {}) as Partial<NoticeInput>) ?? {};
    return { stored, resolved: toResolved(row), organisation: row.organisation ?? '' };
  });

export const saveNotice = async (
  tenantId: TenantId,
  actor: UserId,
  engagementId: string,
  input: NoticeInput,
): Promise<boolean> =>
  withTenant(tenantId, async (client) => {
    const res = await client.query(
      `UPDATE engagements SET privacy_json = privacy_json || jsonb_build_object('notice', $3::jsonb),
              updated_at = now()
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, engagementId, JSON.stringify(input)],
    );
    if (res.rowCount === 0) return false;
    // The trail records that it changed and which parts are set, never the texts.
    await client.query(
      `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
       VALUES ($1, $2, 'privacy.update', 'engagement', $3, $4)`,
      [
        tenantId,
        actor,
        engagementId,
        JSON.stringify({
          has_contact: Boolean(input.contactName || input.contactEmail),
          providers: input.providers.length,
          ai_on: input.aiOn,
        }),
      ],
    );
    return true;
  });
