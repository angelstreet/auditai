import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runEval, type GoldItem } from './evaluate.js';
import { MockProvider } from './providers.js';
import { testConfig } from './testFixtures.js';

const gold = (
  JSON.parse(readFileSync(new URL('../../eval/gold.json', import.meta.url), 'utf8')) as {
    items: GoldItem[];
  }
).items;
const now = () => new Date('2026-10-15T10:00:00Z');

describe('AI eval on the gold set', () => {
  it('keeps only grounded claims and finds the expected themes on the mock', async () => {
    const r = await runEval(gold, () => new MockProvider(testConfig()), testConfig(), now);
    expect(r.errors).toBe(0);
    expect(r.groundedClaimRate).toBe(1);
    expect(r.themeRecall).toBe(1);
    expect(r.items.some((i) => i.locale === 'fr')).toBe(true);
    expect(r.cost).toBeGreaterThan(0);
  });

  it('counts fabricated claims as hallucinations and keeps none of them', async () => {
    const fake = JSON.stringify({
      facts: [{ id: 'f1', statement: 'Saves 90%', sourceId: 'nope', quote: 'saves 90%' }],
      themes: [],
      contradictions: [],
      interviewQuestions: [],
      opportunities: [],
    });
    const r = await runEval(gold, () => new MockProvider(testConfig(), [fake]), testConfig(), now);
    expect(r.hallucinationRate).toBe(1);
    expect(r.groundedClaimRate).toBe(1);
  });

  it('stops the run at the monthly cap: later items fail closed', async () => {
    const r = await runEval(
      gold,
      () => new MockProvider(testConfig()),
      testConfig({ maxCostPerTenantMonth: 0.0185 }),
      now,
    );
    const first = r.items.findIndex((i) => i.error !== null);
    expect(first).toBeGreaterThan(0);
    expect(r.items.slice(first).every((i) => i.error === 'CostCeilingError')).toBe(true);
    expect(r.cost).toBeLessThan(0.0185);
  });
});
