/**
 * Evaluation over the synthetic gold set (TASK-H): grounded-claim rate, hallucination rate and
 * (on the mock) theme recall. Reports ids and rates only, never answer text.
 */
import { runLlmPipeline } from './llmPipeline.js';
import type { AiConfig } from './config.js';
import type { ModelProvider } from './providers.js';
import { textSubmission, type FixtureAnswer } from './testFixtures.js';

export interface GoldItem {
  readonly id: string;
  readonly locale: 'fr' | 'en';
  readonly answers: ReadonlyArray<FixtureAnswer>;
  readonly expectedThemes: ReadonlyArray<string>;
}

export interface ItemReport {
  readonly id: string;
  readonly locale: string;
  readonly proposed: number;
  readonly dropped: number;
  readonly keptClaims: number;
  readonly groundedClaims: number;
  readonly missingThemes: ReadonlyArray<string>;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cost: number;
  readonly attempts: number;
  /** Why the validators dropped items (fixed reason strings, no content). */
  readonly dropReasons: ReadonlyArray<string>;
  readonly error: string | null;
}

export interface EvalReport {
  readonly items: ReadonlyArray<ItemReport>;
  readonly groundedClaimRate: number;
  readonly hallucinationRate: number;
  readonly themeRecall: number;
  readonly errors: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Total cost from the configured rates, in `currency`. */
  readonly cost: number;
  readonly currency: string;
}

export const runEval = async (
  gold: ReadonlyArray<GoldItem>,
  makeProvider: () => ModelProvider,
  config: AiConfig,
  now: () => Date = () => new Date(),
): Promise<EvalReport> => {
  const items: ItemReport[] = [];
  // The whole run counts as one tenant month, so the monthly cap bounds the run's total spend.
  let spent = 0;
  for (const g of gold) {
    const source = new Map(g.answers.map((a) => [a.id, a.text]));
    try {
      const res = await runLlmPipeline(textSubmission(g.answers, { locale: g.locale }), {
        provider: makeProvider(),
        config,
        now,
        tenantMonthSpend: spent,
      });
      spent += res.meta.cost;
      const p = res.payload;
      // Every claim the auditor would see, re-checked against the original answer text.
      const claims = [
        ...p.evidence,
        ...p.themes.flatMap((t) => t.evidence),
        ...(p.opportunities ?? []).flatMap((o) => o.evidence),
      ];
      const grounded = claims.filter((c) => source.get(c.sourceId)?.includes(c.quote) === true);
      const themeIds = new Set(p.themes.map((t) => t.id));
      items.push({
        id: g.id,
        locale: g.locale,
        proposed: res.proposed,
        dropped: p.unsupported?.length ?? 0,
        keptClaims: claims.length,
        groundedClaims: grounded.length,
        missingThemes: g.expectedThemes.filter((t) => !themeIds.has(t)),
        inputTokens: res.meta.inputTokens,
        outputTokens: res.meta.outputTokens,
        cost: res.meta.cost,
        attempts: res.meta.attempts,
        dropReasons: (p.unsupported ?? []).map((u) => `${u.kind}: ${u.reason}`),
        error: null,
      });
    } catch (err) {
      items.push({
        id: g.id,
        locale: g.locale,
        proposed: 0,
        dropped: 0,
        keptClaims: 0,
        groundedClaims: 0,
        missingThemes: g.expectedThemes,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        attempts: 0,
        dropReasons: [],
        error: err instanceof Error ? err.name : 'Error',
      });
    }
  }
  const sum = (f: (i: ItemReport) => number) => items.reduce((n, i) => n + f(i), 0);
  const expected = gold.reduce((n, g) => n + g.expectedThemes.length, 0);
  return {
    items,
    groundedClaimRate:
      sum((i) => i.keptClaims) === 0 ? 1 : sum((i) => i.groundedClaims) / sum((i) => i.keptClaims),
    hallucinationRate:
      sum((i) => i.proposed) === 0 ? 0 : sum((i) => i.dropped) / sum((i) => i.proposed),
    themeRecall: expected === 0 ? 1 : (expected - sum((i) => i.missingThemes.length)) / expected,
    errors: items.filter((i) => i.error !== null).length,
    inputTokens: sum((i) => i.inputTokens),
    outputTokens: sum((i) => i.outputTokens),
    cost: spent,
    currency: config.caps.currency,
  };
};
