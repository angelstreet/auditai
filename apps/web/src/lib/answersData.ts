import type pg from 'pg';
import type { EngagementId, TenantId } from '@evolai/contracts';
import { withTenant } from './db';
import { MIN_GROUP_SIZE } from './invitationTracking';

/**
 * What the auditor may read of the answers (TASK-AA). Ingestion already anonymised every free text
 * (ADR 0044), and nothing here is shown or exported unless at least `MIN_GROUP_SIZE` people have
 * submitted for the engagement: below that, a lone answer could point at a person.
 */

export class AnswersGroupTooSmallError extends Error {
  constructor(readonly submitted: number) {
    super(`fewer than ${MIN_GROUP_SIZE} submissions (${submitted})`);
    this.name = 'AnswersGroupTooSmallError';
  }
}

interface AnswerDbRow {
  respondent_pseudonym: string;
  engagement_id: string;
  question_code: string;
  question_kind: string;
  prompt: string;
  options_json: unknown;
  value_json: unknown;
  rationale: string | null;
  answered_at: string;
}

export interface AnswerLine {
  readonly pseudonym: string;
  readonly engagementId: string;
  readonly questionCode: string;
  readonly question: string;
  /** `short_text` and `end_comment` hold what the person wrote; the other kinds hold a choice. */
  readonly kind: string;
  readonly value: string;
  readonly comment: string;
  readonly answeredAt: string;
}

/** Engagements of the tenant with at least `MIN_GROUP_SIZE` submitted surveys, with their count. */
export const submittedCounts = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId?: string,
): Promise<Map<string, number>> => {
  const { rows } = await client.query<{ engagement_id: string; n: string }>(
    `SELECT engagement_id, count(*)::text AS n FROM submissions
      WHERE tenant_id = $1 AND status = 'submitted' AND ($2::uuid IS NULL OR engagement_id = $2)
      GROUP BY engagement_id`,
    [tenantId, engagementId ?? null],
  );
  return new Map(rows.map((r) => [r.engagement_id, Number(r.n)]));
};

const labelOf = (options: unknown, value: string): string => {
  const list = Array.isArray(options) ? (options as Array<{ value?: unknown; label?: unknown }>) : [];
  const hit = list.find((o) => o.value === value);
  return typeof hit?.label === 'string' ? hit.label : value;
};

/** The shown form of one stored answer value. Skipped questions are an empty string. */
export const answerValueText = (value: unknown, options: unknown): string => {
  const v = (value ?? {}) as Record<string, unknown>;
  switch (v['kind']) {
    case 'single_choice':
    case 'scenario_choice':
      return typeof v['choice'] === 'string' ? labelOf(options, v['choice']) : '';
    case 'multi_choice':
      return Array.isArray(v['choices'])
        ? v['choices'].map((c) => labelOf(options, String(c))).join(' | ')
        : '';
    case 'short_text':
      return typeof v['text'] === 'string' ? v['text'] : '';
    case 'scale_5':
      return typeof v['value'] === 'number' ? String(v['value']) : '';
    case 'boolean':
      return typeof v['value'] === 'boolean' ? String(v['value']) : '';
    default:
      return '';
  }
};

/** Answers of the given engagements (all already past the minimum group), oldest first. */
export const loadAnswerLines = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementIds: readonly string[],
): Promise<AnswerLine[]> => {
  if (engagementIds.length === 0) return [];
  const { rows } = await client.query<AnswerDbRow>(
    `SELECT i.respondent_pseudonym, s.engagement_id, q.code AS question_code, q.kind AS question_kind,
            q.prompt, q.options_json, a.value_json, a.rationale, a.created_at AS answered_at
       FROM answers a
       JOIN submissions s ON s.id = a.submission_id
       JOIN invitations i ON i.id = s.invitation_id
       JOIN question_items q ON q.id = a.question_item_id
      WHERE a.tenant_id = $1 AND s.tenant_id = $1 AND s.status = 'submitted'
        AND s.engagement_id = ANY ($2::uuid[])
      ORDER BY a.created_at ASC, a.sequence ASC`,
    [tenantId, engagementIds],
  );
  const lines = rows.map((r) => ({
    pseudonym: r.respondent_pseudonym,
    engagementId: r.engagement_id,
    questionCode: r.question_code,
    question: r.prompt,
    kind: r.question_kind,
    value: answerValueText(r.value_json, r.options_json),
    comment: r.rationale ?? '',
    answeredAt: r.answered_at,
  }));
  const ends = await client.query<{
    respondent_pseudonym: string;
    engagement_id: string;
    end_comment: string;
    answered_at: string;
  }>(
    `SELECT i.respondent_pseudonym, s.engagement_id, s.end_comment, s.submitted_at AS answered_at
       FROM submissions s JOIN invitations i ON i.id = s.invitation_id
      WHERE s.tenant_id = $1 AND s.status = 'submitted' AND s.end_comment IS NOT NULL
        AND s.engagement_id = ANY ($2::uuid[])
      ORDER BY s.submitted_at ASC`,
    [tenantId, engagementIds],
  );
  for (const e of ends.rows) {
    lines.push({
      pseudonym: e.respondent_pseudonym,
      engagementId: e.engagement_id,
      questionCode: 'end_comment',
      question: '',
      kind: 'end_comment',
      value: e.end_comment,
      comment: '',
      answeredAt: e.answered_at,
    });
  }
  return lines;
};

/** Rows of the `answers` export: engagements below the minimum group are left out, none = refusal. */
export const answersExportRows = async (
  client: pg.PoolClient,
  tenantId: string,
): Promise<{ columns: string[]; values: unknown[][] }> => {
  const counts = await submittedCounts(client, tenantId);
  const eligible = [...counts].filter(([, n]) => n >= MIN_GROUP_SIZE).map(([id]) => id);
  if (eligible.length === 0) {
    throw new AnswersGroupTooSmallError(Math.max(0, ...counts.values()));
  }
  const lines = await loadAnswerLines(client, tenantId, eligible);
  return {
    columns: [
      'respondent_pseudonym',
      'engagement_id',
      'question_code',
      'question',
      'answer',
      'comment',
      'answered_at',
    ],
    values: lines.map((l) => [
      l.pseudonym,
      l.engagementId,
      l.questionCode,
      l.question,
      l.value,
      l.comment,
      l.answeredAt,
    ]),
  };
};

export interface AnswersView {
  readonly submitted: number;
  /** Per question: how many people picked each option (labels as shown to the respondent). */
  readonly choices: ReadonlyArray<{
    readonly code: string;
    readonly question: string;
    readonly counts: ReadonlyArray<{ label: string; n: number }>;
  }>;
  /** Free texts, per question, with no link to a person and in a stable, unrelated order. */
  readonly texts: ReadonlyArray<{
    readonly code: string;
    readonly question: string;
    readonly items: readonly string[];
  }>;
}

/** Read-only view for one engagement, or the count when it is below the minimum group. */
export const answersViewFor = (
  tenantId: TenantId,
  engagementId: EngagementId,
): Promise<AnswersView | { tooFew: number }> =>
  withTenant(tenantId, async (client) => {
    const submitted = (await submittedCounts(client, tenantId, engagementId)).get(engagementId) ?? 0;
    if (submitted < MIN_GROUP_SIZE) return { tooFew: submitted };
    const lines = await loadAnswerLines(client, tenantId, [engagementId]);
    const choiceMap = new Map<string, { question: string; counts: Map<string, number> }>();
    const textMap = new Map<string, { question: string; items: string[] }>();
    const addText = (l: AnswerLine, text: string): void => {
      if (text === '') return;
      const e = textMap.get(l.questionCode) ?? { question: l.question, items: [] };
      e.items.push(text);
      textMap.set(l.questionCode, e);
    };
    for (const l of lines) {
      if (l.kind === 'short_text' || l.kind === 'end_comment') {
        addText(l, l.value);
        continue;
      }
      if (l.value !== '') {
        const e = choiceMap.get(l.questionCode) ?? { question: l.question, counts: new Map() };
        for (const label of l.value.split(' | ')) {
          e.counts.set(label, (e.counts.get(label) ?? 0) + 1);
        }
        choiceMap.set(l.questionCode, e);
      }
      addText(l, l.comment);
    }
    return {
      submitted,
      choices: [...choiceMap].map(([code, e]) => ({
        code,
        question: e.question,
        counts: [...e.counts].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
      })),
      texts: [...textMap].map(([code, e]) => ({
        code,
        question: e.question,
        items: [...e.items].sort((a, b) => a.localeCompare(b)),
      })),
    };
  });
