/**
 * Report summary draft job (TASK-V, ADR 0043). Run by the owner for one engagement:
 *
 *   pnpm --filter @evolai/ai report-draft -- --tenant <id> --engagement <id> --actor <user id>
 *
 * Reads, under the tenant's row-level security, the working report (draft or in review only),
 * the approved findings (at least five people each) and the accepted steps, asks the approved
 * route for a draft (`draftReportSummary`), and stores it in `audit_reports.ai_draft_json` with an
 * `report.ai_draft` audit row (route, prompt version, tokens, cost; never the text). The
 * client never sees it; the auditor may copy it into the summary.
 */
import type pg from 'pg';
import { aggregateFindings, findingKey, rankOpportunities, type Finding } from '@evolai/domain';

import { loadAiConfig, resolveRoute, type AiConfig } from './llm/config.js';
import { stderrLogger, type AiLogger } from './llm/log.js';
import { createProvider, type ModelProvider } from './llm/providers.js';
import { draftReportSummary, type ReportDraft } from './llm/reportDraft.js';

export const MIN_GROUP_SIZE = 5;
const APPROVED_OPPORTUNITY = ['approved', 'in_progress', 'delivered'];

export class ReportDraftError extends Error {
  constructor(readonly code: 'no_report' | 'locked' | 'not_staff' | 'rule_based') {
    super(code);
    this.name = 'ReportDraftError';
  }
}

export interface ReportDraftJobOptions {
  readonly tenantId: string;
  readonly engagementId: string;
  /** The auditor or owner who asked for the draft; must be staff of the tenant. */
  readonly actorUserId: string;
  readonly client: pg.Client;
  readonly config?: AiConfig;
  readonly provider?: ModelProvider;
  readonly env?: NodeJS.ProcessEnv;
  readonly log?: AiLogger;
  readonly now?: () => Date;
}

type Level = 'low' | 'medium' | 'high';

export const runReportDraftJob = async (o: ReportDraftJobOptions): Promise<ReportDraft> => {
  const env = o.env ?? process.env;
  const config = o.config ?? loadAiConfig(env);
  const provider = o.provider ?? createProvider(config, resolveRoute(config, env));
  // The rule-based route never calls a model: the screen already writes a rule-based draft.
  if (!provider) throw new ReportDraftError('rule_based');
  const c = o.client;
  await c.query('SET ROLE auditai_app');
  await c.query('BEGIN');
  try {
    await c.query(`SELECT set_config('app.tenant_id', $1, true)`, [o.tenantId]);
    const staff = await c.query(
      `SELECT 1 FROM memberships WHERE tenant_id = $1 AND user_id = $2
          AND role IN ('platform_owner', 'auditor')`,
      [o.tenantId, o.actorUserId],
    );
    if (staff.rowCount === 0) throw new ReportDraftError('not_staff');
    const rep = await c.query<{ id: string; status: string; locale: 'fr' | 'en' }>(
      `SELECT id, status, locale FROM audit_reports WHERE tenant_id = $1 AND engagement_id = $2`,
      [o.tenantId, o.engagementId],
    );
    const report = rep.rows[0];
    if (!report) throw new ReportDraftError('no_report');
    if (report.status === 'published') throw new ReportDraftError('locked');

    const analyses = await c.query<{ submission_id: string; payload_json: unknown }>(
      `SELECT submission_id, payload_json FROM analyses
        WHERE tenant_id = $1 AND engagement_id = $2 AND approved_at IS NOT NULL`,
      [o.tenantId, o.engagementId],
    );
    const findings: Finding[] = aggregateFindings(
      analyses.rows.map((r) => ({ submissionId: r.submission_id, payload: r.payload_json })),
      MIN_GROUP_SIZE,
    );
    const opps = await c.query<{
      id: string;
      title: string;
      axis: string | null;
      impact_score: string | null;
    }>(
      `SELECT id, title, axis, impact_score FROM opportunities
        WHERE tenant_id = $1 AND engagement_id = $2 AND status = ANY($3::text[])
        ORDER BY created_at, id`,
      [o.tenantId, o.engagementId, APPROVED_OPPORTUNITY],
    );
    const steps = await c.query<{
      opportunity_id: string;
      title: string;
      impact: Level;
      effort: Level;
    }>(
      `SELECT opportunity_id, title, impact, effort FROM report_steps
        WHERE tenant_id = $1 AND report_id = $2 AND status = 'accepted' ORDER BY position, id`,
      [o.tenantId, report.id],
    );
    const ranked = rankOpportunities(
      opps.rows
        .map((op) => ({
          id: op.id,
          title: op.title,
          axis: op.axis,
          impactScore: op.impact_score === null ? null : Number(op.impact_score),
          steps: steps.rows.filter((s) => s.opportunity_id === op.id),
        }))
        .filter((op) => op.steps.length > 0),
    );
    const terms = await c.query<{ term: string }>(
      'SELECT term FROM ai_redaction_terms WHERE tenant_id = $1',
      [o.tenantId],
    );
    const spend = await c.query<{ spend: string }>(
      `SELECT (COALESCE((SELECT SUM(cost_amount) FROM analyses
                          WHERE tenant_id = $1 AND generated_at >= date_trunc('month', now())), 0)
             + COALESCE((SELECT SUM((payload_json->>'costAmount')::numeric) FROM audit_log
                          WHERE tenant_id = $1 AND action = 'report.ai_draft'
                            AND created_at >= date_trunc('month', now())), 0))::text AS spend`,
      [o.tenantId],
    );

    const draft = await draftReportSummary(
      {
        tenantId: o.tenantId,
        reportId: report.id,
        locale: report.locale,
        findings: findings.map((f) => ({ ...f, key: findingKey(f.axis, f.label) })),
        opportunities: ranked.map((r) => ({
          rank: r.rank,
          title: r.title,
          steps: steps.rows.filter((s) => s.opportunity_id === r.id).map((s) => s.title),
        })),
      },
      {
        provider,
        config,
        tenantNames: terms.rows.map((r) => r.term),
        tenantMonthSpend: Number(spend.rows[0]?.spend ?? 0),
        log: o.log ?? stderrLogger,
        ...(o.now ? { now: o.now } : {}),
      },
    );
    await c.query(
      `UPDATE audit_reports SET ai_draft_json = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2`,
      [
        o.tenantId,
        report.id,
        JSON.stringify({
          text: draft.text,
          citations: draft.citations,
          route: draft.route,
          modelVersion: draft.modelVersion,
          promptVersion: draft.promptVersion,
          generatedAt: draft.generatedAt,
        }),
      ],
    );
    await c.query(
      `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
       VALUES ($1, $2, 'report.ai_draft', 'report', $3, $4)`,
      [
        o.tenantId,
        o.actorUserId,
        report.id,
        JSON.stringify({
          route: draft.route,
          modelVersion: draft.modelVersion,
          promptVersion: draft.promptVersion,
          inputTokens: draft.inputTokens,
          outputTokens: draft.outputTokens,
          costAmount: draft.costAmount,
          costCurrency: draft.costCurrency,
          citations: draft.citations.length,
          dropped: draft.dropped,
        }),
      ],
    );
    await c.query('COMMIT');
    return draft;
  } catch (err) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw err;
  }
};
