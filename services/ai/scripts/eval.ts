/**
 * `pnpm ai:eval` (TASK-H): run the synthetic gold set through the model-backed pipeline and
 * report grounded-claim rate, hallucination rate and theme recall.
 *
 * Default: the mock provider, no network, deterministic; CI runs this and fails on any
 * ungrounded kept claim, any error or a missed expected theme.
 *
 * Real model (owner, manual): set EVOLAI_AI_EVAL_LIVE=1 plus the EVOLAI_AI_* route variables
 * (ADR 0029). The live run fails only on an ungrounded kept claim or an error; theme ids of a
 * real model differ from the mock's, so recall is printed for information.
 */
import { readFileSync } from 'node:fs';
import { loadAiConfig, resolveRoute } from '../src/llm/config.js';
import { runEval, type GoldItem } from '../src/llm/evaluate.js';
import { createProvider, MockProvider } from '../src/llm/providers.js';

const main = async (): Promise<void> => {
  const live = process.env['EVOLAI_AI_EVAL_LIVE'] === '1';
  const gold = (
    JSON.parse(readFileSync(new URL('../eval/gold.json', import.meta.url), 'utf8')) as {
      items: GoldItem[];
    }
  ).items;
  const config = loadAiConfig();
  const makeProvider = () => {
    if (!live) return new MockProvider(config);
    const provider = createProvider(config, resolveRoute(config));
    if (!provider) throw new Error('EVOLAI_AI_EVAL_LIVE=1 needs a model route, not rule-based');
    return provider;
  };
  const report = await runEval(gold, makeProvider, config);
  for (const i of report.items) {
    process.stdout.write(
      `${i.id.padEnd(14)} ${i.locale} proposed=${i.proposed} dropped=${i.dropped} kept-claims=${i.keptClaims} grounded=${i.groundedClaims}` +
        ` tokens=${i.inputTokens}/${i.outputTokens} attempts=${i.attempts}` +
        `${i.missingThemes.length ? ` missing-themes=${i.missingThemes.join(',')}` : ''}${i.error ? ` error=${i.error}` : ''}\n`,
    );
    for (const r of i.dropReasons) process.stdout.write(`  dropped ${r}\n`);
  }
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  process.stdout.write(
    `AI eval (${live ? 'live route' : 'mock/fixture-v1'}): grounded-claim rate ${pct(report.groundedClaimRate)}, hallucination rate ${pct(report.hallucinationRate)}, theme recall ${pct(report.themeRecall)}, errors ${report.errors}, tokens in/out ${report.inputTokens}/${report.outputTokens}, cost ${report.cost.toFixed(6)} ${report.currency}\n`,
  );
  const failed =
    report.groundedClaimRate < 1 || report.errors > 0 || (!live && report.themeRecall < 1);
  if (failed) process.exit(1);
};

main().catch((err) => {
  process.stderr.write(`AI eval failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
