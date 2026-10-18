/**
 * Mechanical grounding checks on model output (TASK-H, PRD §10, FR-12).
 *
 * Nothing the model writes is trusted:
 *
 * - a fact survives only if its `sourceId` is one of the answers sent in this call and its
 *   `quote` is a verbatim substring of that answer's (redacted) text;
 * - a number survives only if it is copied from the fact's own quote; it is then labelled
 *   self-reported;
 * - themes, contradictions, interview questions and opportunities survive only if what they
 *   cite survived, and any number in their text appears in the quotes they cite (so the model
 *   cannot fabricate ROI, counts or timing).
 *
 * Every dropped item is listed in `unsupported` with a reason, so the auditor and the eval can
 * see what the model tried.
 */
import type { ModelOutput } from './prompt.js';

export interface VerifiedFact {
  readonly id: string;
  readonly statement: string;
  readonly sourceId: string;
  readonly quote: string;
  readonly number: {
    readonly value: string;
    readonly unit: string;
    readonly kind: 'volume' | 'time' | 'benefit' | 'other';
    readonly selfReported: true;
  } | null;
}

export interface UnsupportedItem {
  readonly kind: 'fact' | 'theme' | 'contradiction' | 'interviewQuestion' | 'opportunity';
  readonly id: string;
  readonly reason: string;
}

export interface VerifiedOutput {
  readonly facts: ReadonlyArray<VerifiedFact>;
  readonly themes: ModelOutput['themes'];
  readonly contradictions: ModelOutput['contradictions'];
  readonly interviewQuestions: ModelOutput['interviewQuestions'];
  readonly opportunities: ModelOutput['opportunities'];
  readonly unsupported: ReadonlyArray<UnsupportedItem>;
  /** Items the model proposed, all kinds. */
  readonly proposed: number;
}

const PLACEHOLDER_RE = /\[(?:EMAIL|PHONE|IBAN|ID|NAME)_\d+\]/g;

/** Digit groups in a text, ignoring redaction placeholders. */
export const numbersIn = (text: string): string[] =>
  text.replace(PLACEHOLDER_RE, ' ').match(/\d+(?:[.,]\d+)*/g) ?? [];

const numbersSupported = (text: string, quotes: ReadonlyArray<string>): boolean => {
  const pool = quotes.join('\n');
  return numbersIn(text).every((n) => pool.includes(n));
};

export const verifyOutput = (
  out: ModelOutput,
  sources: ReadonlyMap<string, string>,
): VerifiedOutput => {
  const unsupported: UnsupportedItem[] = [];
  const facts = new Map<string, VerifiedFact>();

  for (const f of out.facts) {
    const source = sources.get(f.sourceId);
    const drop = (reason: string) => unsupported.push({ kind: 'fact', id: f.id, reason });
    if (facts.has(f.id)) {
      drop('duplicate fact id');
      continue;
    }
    if (source === undefined) {
      drop('cites a record that was not in this analysis');
      continue;
    }
    if (f.quote.trim().length === 0 || !source.includes(f.quote)) {
      drop('quote is not a verbatim part of the cited answer');
      continue;
    }
    if (!numbersSupported(f.statement, [f.quote])) {
      drop('statement has a number that is not in its quote');
      continue;
    }
    let number: VerifiedFact['number'] = null;
    if (f.number) {
      if (!f.quote.includes(f.number.value) || numbersIn(f.number.value).length === 0) {
        drop('number is not copied from the quote');
        continue;
      }
      number = { ...f.number, selfReported: true };
    }
    facts.set(f.id, {
      id: f.id,
      statement: f.statement,
      sourceId: f.sourceId,
      quote: f.quote,
      number,
    });
  }

  const quotesOf = (ids: ReadonlyArray<string>): string[] =>
    ids.flatMap((id) => {
      const f = facts.get(id);
      return f ? [f.quote] : [];
    });

  const themes: ModelOutput['themes'][number][] = [];
  for (const t of out.themes) {
    const kept = t.factIds.filter((id) => facts.has(id));
    if (kept.length === 0) {
      unsupported.push({ kind: 'theme', id: t.id, reason: 'no supported fact cited' });
      continue;
    }
    if (!numbersSupported(`${t.label} ${t.summary}`, quotesOf(kept))) {
      unsupported.push({ kind: 'theme', id: t.id, reason: 'number not found in cited quotes' });
      continue;
    }
    themes.push({ ...t, factIds: kept });
  }
  const themeById = new Map(themes.map((t) => [t.id, t]));

  const contradictions = out.contradictions.filter((c) => {
    const ok = facts.has(c.factA) && facts.has(c.factB) && c.factA !== c.factB;
    const grounded = ok && numbersSupported(c.explanation, quotesOf([c.factA, c.factB]));
    if (!grounded) {
      unsupported.push({
        kind: 'contradiction',
        id: `${c.factA}~${c.factB}`,
        reason: ok ? 'number not found in cited quotes' : 'cites a fact that was dropped',
      });
    }
    return grounded;
  });

  const interviewQuestions = out.interviewQuestions.filter((q) => {
    const theme = themeById.get(q.themeId);
    const grounded =
      theme !== undefined &&
      numbersSupported(`${q.question} ${q.rationale}`, quotesOf(theme.factIds));
    if (!grounded) {
      unsupported.push({
        kind: 'interviewQuestion',
        id: q.id,
        reason: theme ? 'number not found in cited quotes' : 'cites a theme that was dropped',
      });
    }
    return grounded;
  });

  const opportunities: ModelOutput['opportunities'][number][] = [];
  for (const o of out.opportunities) {
    const kept = o.factIds.filter((id) => facts.has(id));
    if (!themeById.has(o.themeId) || kept.length === 0) {
      unsupported.push({ kind: 'opportunity', id: o.id, reason: 'no supported theme or fact' });
      continue;
    }
    if (!numbersSupported(`${o.title} ${o.description}`, quotesOf(kept))) {
      unsupported.push({
        kind: 'opportunity',
        id: o.id,
        reason: 'number not found in cited quotes',
      });
      continue;
    }
    opportunities.push({ ...o, factIds: kept });
  }

  return {
    facts: Array.from(facts.values()),
    themes,
    contradictions,
    interviewQuestions,
    opportunities,
    unsupported,
    proposed:
      out.facts.length +
      out.themes.length +
      out.contradictions.length +
      out.interviewQuestions.length +
      out.opportunities.length,
  };
};
