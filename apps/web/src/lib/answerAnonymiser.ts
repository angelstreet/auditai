import type { TenantId } from '@evolai/contracts';
import { anonymise, type AnonymiseLocale } from '@evolai/domain';
import { withTenant } from './db';

/**
 * Free text is anonymised before it is written (TASK-W, ADR 0044). The caller keeps only the
 * returned text; the typed original goes no further than this function and is never logged.
 */
export const MAX_COMMENT_LENGTH = 2000;

export const loadHiddenTerms = async (tenantId: TenantId): Promise<string[]> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ term: string }>(
      `SELECT term FROM ai_redaction_terms WHERE tenant_id = $1`,
      [tenantId],
    );
    return rows.map((r) => r.term);
  });

/** Anonymised text for storage, or null when the person wrote nothing. */
export const anonymiseForStorage = async (
  tenantId: TenantId,
  raw: string,
  locale: AnonymiseLocale,
): Promise<string | null> => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const terms = await loadHiddenTerms(tenantId);
  const { text } = anonymise(trimmed, { locale, terms });
  return text.slice(0, MAX_COMMENT_LENGTH);
};
