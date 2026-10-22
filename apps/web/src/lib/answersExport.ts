import type { TenantId } from '@evolai/contracts';
import type { SessionPayload } from './session';
import { answersCsvRows } from './answersData';
import { withTenant } from './db';
import { rowsToCsv } from './exportData';
import { effectiveContext, isTenantAllowed } from './tenantAccess';

/**
 * Who may take the answers out (TASK-AD2): EvolAI staff of that organisation, signed in as
 * themselves. A referent, and the owner viewing as one, never.
 */
export const mayReadAnswers = (session: SessionPayload | null, tenantId: string): boolean =>
  Boolean(
    session &&
      !session.viewAs &&
      effectiveContext(session).kind === 'staff' &&
      isTenantAllowed(session, tenantId),
  );

/** The CSV of one mission's answers, with one audit row that holds counts only. */
export const answersCsv = (
  tenantId: TenantId,
  engagementId: string,
  actorUserId: string,
): Promise<string> =>
  withTenant(tenantId, async (client) => {
    const rows = await answersCsvRows(client, tenantId, engagementId);
    await client.query(
      `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
       VALUES ($1, $2, 'export.complete', 'engagement', $3, $4)`,
      [
        tenantId,
        actorUserId,
        engagementId,
        JSON.stringify({ kind: 'answers', rows: rows.values.length }),
      ],
    );
    return rowsToCsv(rows.columns, rows.values);
  });
