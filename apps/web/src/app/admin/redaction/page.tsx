import { EmptyState, PageTitle } from '@evolai/ui';
import { withServiceAccount } from '@/lib/db';
import { sessionTenantIds } from '@/lib/authServer';
import { listRedactionTerms } from '@/lib/redactionTermData';
import { getT } from '@/lib/i18n';
import type { TenantId } from '@evolai/contracts';
import { RedactionListClient } from './RedactionListClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { tenant?: string };
}

/**
 * Admin: per-tenant redaction-term list (TASK-Q, Gate B, PRD §10, ADR 0029, ADR 0035).
 *
 * Each row is one term the redactor will replace with a `[NAME_n]` placeholder before any
 * model call. Add / remove goes through a server action that writes one `audit_log` row per
 * change with `target_kind = 'redaction_term'`, so the trail records who added or removed
 * which term and when.
 */
export default async function RedactionPage({ searchParams }: PageProps) {
  const { t, locale } = getT();
  const tenants = await sessionTenantIds();
  const requested = searchParams.tenant;
  const current = (tenants.find((x) => x === requested) ?? tenants[0]) as TenantId | undefined;
  if (!current) {
    return (
      <div className="wide">
        <PageTitle title={t('admin.redaction.title')} subtitle={t('admin.redaction.intro')} />
        <EmptyState title={t('admin.common.noTenantsTitle')} />
      </div>
    );
  }
  const [terms, auditTrail] = await Promise.all([
    listRedactionTerms(current),
    readAuditTrail(current),
  ]);
  return (
    <div className="wide">
      <PageTitle title={t('admin.redaction.title')} subtitle={t('admin.redaction.intro')} />
      <RedactionListClient
        tenantId={current}
        terms={terms}
        auditTrail={auditTrail}
        locale={locale}
        emptyTitle={t('admin.redaction.none')}
      />
      <p className="muted footnote">{t('admin.redaction.footnote')}</p>
    </div>
  );
}

/**
 * Reads the most recent redaction_term.add / redaction_term.remove audit rows for the
 * tenant. The trail is purely informational here: the data layer already wrote it as part
 * of the add / remove path.
 */
const readAuditTrail = async (
  tenantId: TenantId,
): Promise<
  ReadonlyArray<{
    id: string;
    action: 'redaction_term.add' | 'redaction_term.remove';
    actorName: string;
    term: string;
    createdAt: string;
  }>
> =>
  withServiceAccount(async (client) => {
    // The audit log is tenant-scoped via RLS; a service account reads across tenants but we
    // filter explicitly so the row count matches what the page would render.
    const { rows } = await client.query<{
      id: string;
      action: string;
      actor_name: string | null;
      payload_json: { term?: string };
      created_at: string;
    }>(
      `SELECT al.id, al.action, u.display_name AS actor_name, al.payload_json, al.created_at
         FROM audit_log al
         LEFT JOIN users u ON u.id = al.actor_user_id
        WHERE al.tenant_id = $1
          AND al.target_kind = 'redaction_term'
        ORDER BY al.created_at DESC
        LIMIT 50`,
      [tenantId],
    );
    return rows.map((r) => ({
      id: r.id,
      action: r.action as 'redaction_term.add' | 'redaction_term.remove',
      actorName: r.actor_name ?? '—',
      term: r.payload_json.term ?? '',
      createdAt: r.created_at,
    }));
  });
