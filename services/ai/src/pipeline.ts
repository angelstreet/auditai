/**
 * AI pipeline (M9, PRD \u00a710, ADR 0007).
 *
 * Reads a `submissions` row joined with its `answers` and the corresponding
 * `question_items`, runs the four-step pipeline, and produces an `AnalysisPayload`
 * ready to be inserted into the `analyses` table.
 *
 * The first cut is rule-based: it does not call an LLM. The architecture is
 * designed so an LLM-backed implementation can replace the four
 * `synthesize*` functions without changing the surrounding shape.
 *
 * Every claim links back to a `sourceKind` + `sourceId` + `quote`, so the
 * auditor can verify it before approval (PRD \u00a710, FR-12).
 */
import type { Sensitivity } from '@evolai/contracts';

export interface AnswerRow {
  readonly id: string;
  /** Loaded by the worker; the LLM path refuses rows without it (tenant isolation check). */
  readonly tenant_id?: string;
  readonly submission_id?: string;
  readonly question_item_id: string;
  readonly value_json: unknown;
  readonly sequence: number;
}

export interface QuestionItemRow {
  readonly id: string;
  readonly tenant_id?: string;
  readonly axis: string;
  readonly code: string;
  readonly kind: string;
  readonly locale: string;
  readonly prompt: string;
  readonly options_json: ReadonlyArray<{ value: string; label: string }>;
  readonly scoring_json: { weight: number; reverse: boolean };
  readonly sensitivity: Sensitivity;
}

export interface SubmissionRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly engagement_id: string;
  readonly invitation_id: string;
  readonly status: 'in_progress' | 'submitted';
  readonly locale: string;
  readonly started_at: string;
  readonly submitted_at: string | null;
}

export interface AnalysisClaim {
  readonly claim: string;
  readonly sourceKind: 'answer' | 'question_item';
  readonly sourceId: string;
  readonly quote: string;
  /** `text` for a free-text answer cited word for word; absent for a choice. */
  readonly kind?: 'text';
}

export interface AnalysisTheme {
  readonly id: string;
  readonly label: string;
  readonly axis: string;
  readonly summary: string;
  readonly evidence: ReadonlyArray<AnalysisClaim>;
}

export interface AnalysisInterviewPrompt {
  readonly id: string;
  readonly prompt: string;
  readonly rationale: string;
  readonly themeId: string;
}

/** A fact drafted by a model, already checked against its source answer (TASK-H). */
export interface AnalysisFact {
  readonly id: string;
  readonly statement: string;
  readonly sourceKind: 'answer';
  readonly sourceId: string;
  readonly quote: string;
  /** Numbers are only ever copied from the quote, and stay self-reported until verified. */
  readonly number: {
    readonly value: string;
    readonly unit: string;
    readonly kind: 'volume' | 'time' | 'benefit' | 'other';
    readonly selfReported: true;
  } | null;
}

export interface AnalysisOpportunity {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly themeId: string;
  readonly evidence: ReadonlyArray<AnalysisClaim>;
}

export interface AnalysisPayload {
  /** 1: rule-based pipeline. 2: model-drafted (TASK-H), with the optional fields below. */
  readonly version: 1 | 2;
  /** True when a model drafted the payload; the auditor UI labels it "AI draft". */
  readonly aiDraft?: boolean;
  readonly facts?: ReadonlyArray<AnalysisFact>;
  readonly opportunities?: ReadonlyArray<AnalysisOpportunity>;
  readonly unsupported?: ReadonlyArray<{
    readonly kind: string;
    readonly id: string;
    readonly reason: string;
  }>;
  readonly sensitivity: Sensitivity;
  readonly themes: ReadonlyArray<AnalysisTheme>;
  readonly contradictions: ReadonlyArray<{
    readonly themeA: string;
    readonly themeB: string;
    readonly explanation: string;
  }>;
  readonly interviewPrompts: ReadonlyArray<AnalysisInterviewPrompt>;
  readonly evidence: ReadonlyArray<AnalysisClaim>;
}

export interface PipelineInput {
  readonly submission: SubmissionRow;
  readonly answers: ReadonlyArray<AnswerRow>;
  readonly questionItems: ReadonlyMap<string, QuestionItemRow>;
}

const HIGH_VALUE_LABELS = new Set([
  'high',
  'always',
  'verify_source',
  'check_policy',
  'specific_brief',
  'map_first',
  'deterministic_first',
  '3_6h',
  'gt_6h',
  // Questionnaire v1 (TASK-Z2): the established practice of each scored choice.
  'check_source',
  'check_rules',
  'full_brief',
  'list_steps',
  'simple_automation',
]);

/** The first pipeline step: classify the overall sensitivity (PRD \u00a710, FR-08). */
export const classifySensitivity = (items: ReadonlyArray<QuestionItemRow>): Sensitivity => {
  if (items.some((q) => q.sensitivity === 'sensitive')) return 'sensitive';
  if (items.some((q) => q.sensitivity === 'internal')) return 'internal';
  return 'public';
};

/** The stored shape of a survey answer: `{kind, choice}`, `{kind, choices}` or `{kind, text}`. */
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** The option value a choice answer holds, whether stored bare or as `{kind, choice}`. */
export const choiceValue = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  const rec = asRecord(value);
  return typeof rec?.['choice'] === 'string' ? rec['choice'] : null;
};

export const labelFor = (item: QuestionItemRow, value: unknown): string => {
  if (typeof value !== 'string') return answerPlainText(item, value);
  const opt = item.options_json.find((o) => o.value === value);
  return opt?.label ?? value;
};

/**
 * The words a respondent gave, as they saw them: the text itself for free text, the option label
 * for a choice. Never the stored JSON, so a model and a citation check see only the answer.
 */
export const answerPlainText = (item: QuestionItemRow, value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((v) => labelFor(item, v)).join(', ');
  const rec = asRecord(value);
  if (rec) {
    // A skipped question has no words: it is never shown to a model or cited.
    if (rec['kind'] === 'skipped') return '';
    if (typeof rec['text'] === 'string') return rec['text'];
    if (Array.isArray(rec['choices'])) return labelFor(item, rec['choices']);
    const choice = choiceValue(value);
    if (choice !== null) return labelFor(item, choice);
    return JSON.stringify(value);
  }
  return typeof value === 'string' ? labelFor(item, value) : String(value);
};

const valueIsHigh = (item: QuestionItemRow, rawValue: unknown): boolean => {
  const value = choiceValue(rawValue);
  if (value === null) return false;
  if (HIGH_VALUE_LABELS.has(value)) return true;
  const opt = item.options_json.find((o) => o.value === value);
  if (!opt) return false;
  return /high|always|verify|check|map|deterministic/i.test(opt.label);
};

/** Step 2: extract themes from the answers, grouped by question axis. */
export const extractThemes = (input: PipelineInput): ReadonlyArray<AnalysisTheme> => {
  const groups = new Map<
    string,
    { axis: string; claims: AnalysisClaim[]; items: QuestionItemRow[] }
  >();
  for (const a of input.answers) {
    const item = input.questionItems.get(a.question_item_id);
    if (!item) continue;
    const g = groups.get(item.axis) ?? { axis: item.axis, claims: [], items: [] };
    const isText = item.kind === 'short_text';
    const plain = answerPlainText(item, a.value_json);
    if (plain === '') continue;
    const claim: AnalysisClaim = {
      claim: `${item.prompt} \u2192 ${plain}`,
      sourceKind: 'answer',
      sourceId: a.id,
      // A free-text answer is cited word for word; a choice keeps its stored value.
      quote: isText ? plain : `answer.value_json=${JSON.stringify(a.value_json)}`,
      ...(isText ? { kind: 'text' as const } : {}),
    };
    g.claims.push(claim);
    g.items.push(item);
    groups.set(item.axis, g);
  }
  return Array.from(groups.entries()).map(([axisId, g], idx) => {
    const high = g.claims.filter((c) => {
      const a = input.answers.find((x) => x.id === c.sourceId);
      if (!a) return false;
      const item = input.questionItems.get(a.question_item_id);
      return item ? valueIsHigh(item, a.value_json) : false;
    });
    const texts = g.claims.filter((c) => c.kind === 'text').length;
    const choices = g.claims.length - texts;
    const low = choices - high.length;
    const signals = `${high.length} high-maturity signal(s), ${low} low-maturity signal(s) across ${choices} answer(s)`;
    return {
      id: `theme-${axisId}-${idx}`,
      label: choices === 0 ? `${g.axis} (free text)` : `${g.axis} maturity`,
      axis: g.axis,
      summary:
        g.claims.length === 0
          ? 'no answers'
          : choices === 0
            ? `${texts} free-text answer(s)`
            : texts === 0
              ? signals
              : `${signals}; ${texts} free-text answer(s)`,
      evidence: g.claims,
    } as const;
  });
};

/** Step 3: detect contradictions (high + low in the same axis). */
export const findContradictions = (
  themes: ReadonlyArray<AnalysisTheme>,
): ReadonlyArray<{ themeA: string; themeB: string; explanation: string }> => {
  const out: { themeA: string; themeB: string; explanation: string }[] = [];
  for (const t of themes) {
    // Choices only: the stored value is matched, never a free-text answer's words.
    const choices = t.evidence.filter((c) => c.kind !== 'text');
    const hasHigh = choices.some((c) =>
      /high|verify|check|map|deterministic|always|full_brief|list_steps|simple_automation/i.test(
        c.quote,
      ),
    );
    const hasLow = choices.some((c) =>
      /low|use_as_is|paste_anyway|paste_directly|short_vague|one_line|jump_to_ai|look_for_tool|lt_1h/i.test(
        c.quote,
      ),
    );
    if (hasHigh && hasLow) {
      out.push({
        themeA: t.id,
        themeB: t.id,
        explanation: `mixed signals on axis ${t.axis}: at least one high-maturity answer and at least one low-maturity answer`,
      });
    }
  }
  return out;
};

/** Step 4: generate interview prompts that target the lowest-evidence axis. */
export const buildInterviewPrompts = (
  themes: ReadonlyArray<AnalysisTheme>,
): ReadonlyArray<AnalysisInterviewPrompt> => {
  if (themes.length === 0) return [];
  const weakest = [...themes].sort((a, b) => a.evidence.length - b.evidence.length)[0];
  if (!weakest) return [];
  return [
    {
      id: `prompt-${weakest.id}-1`,
      prompt: `Walk me through a recent task on the ${weakest.axis} axis and the decision you made.`,
      rationale: `lowest-evidence axis: ${weakest.axis} (${weakest.evidence.length} answer(s))`,
      themeId: weakest.id,
    },
    {
      id: `prompt-${weakest.id}-2`,
      prompt: `Where does the current ${weakest.axis} practice create friction or risk?`,
      rationale: 'targets gap between self-report and observed workflow',
      themeId: weakest.id,
    },
  ];
};

const dedupeClaims = (claims: ReadonlyArray<AnalysisClaim>): ReadonlyArray<AnalysisClaim> => {
  const seen = new Set<string>();
  const out: AnalysisClaim[] = [];
  for (const c of claims) {
    if (seen.has(c.sourceId)) continue;
    seen.add(c.sourceId);
    out.push(c);
  }
  return out;
};

export const runPipeline = (input: PipelineInput): AnalysisPayload => {
  const items = input.answers
    .filter((a) => {
      const item = input.questionItems.get(a.question_item_id);
      return item ? answerPlainText(item, a.value_json) !== '' : false;
    })
    .map((a) => input.questionItems.get(a.question_item_id))
    .filter((q): q is QuestionItemRow => Boolean(q));
  const sensitivity = classifySensitivity(items);
  const themes = extractThemes(input);
  const contradictions = findContradictions(themes);
  const interviewPrompts = buildInterviewPrompts(themes);
  const evidence = dedupeClaims(themes.flatMap((t) => t.evidence));
  return {
    version: 1,
    sensitivity,
    themes,
    contradictions,
    interviewPrompts,
    evidence,
  };
};
