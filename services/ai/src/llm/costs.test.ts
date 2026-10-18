import { describe, expect, it } from 'vitest';
import { parseAiConfig } from './config.js';
import { checkBudget, costOf, CostCeilingError, estimateTokens, findRate } from './costs.js';
import { testConfig } from './testFixtures.js';

const route = { provider: 'mock' as const, model: 'fixture-v1', region: 'local', baseUrl: null };

const twoRates = () =>
  parseAiConfig({
    ...testConfig(),
    rates: [
      ...testConfig().rates,
      { ...testConfig().rates[0], effectiveFrom: '2026-06-01T00:00:00Z', inputPerMillionTokens: 3 },
    ],
  });

describe('cost ceiling', () => {
  it('estimates tokens conservatively', () => {
    expect(estimateTokens('abcdef')).toBe(2);
    expect(estimateTokens('abcdefg')).toBe(3);
  });

  it('picks the latest rate in force at the call time', () => {
    expect(findRate(twoRates(), route, new Date('2026-03-01')).inputPerMillionTokens).toBe(1);
    expect(findRate(twoRates(), route, new Date('2026-07-01')).inputPerMillionTokens).toBe(3);
  });

  it('refuses a call with no rate for its route or date', () => {
    expect(() => findRate(testConfig(), route, new Date('2025-01-01'))).toThrow(CostCeilingError);
    expect(() => findRate(testConfig(), { ...route, model: 'other' }, new Date())).toThrow(
      CostCeilingError,
    );
  });

  it('refuses a rate in another currency than the caps', () => {
    const cfg = parseAiConfig({
      ...testConfig(),
      rates: [{ ...testConfig().rates[0], currency: 'USD' }],
    });
    expect(() => findRate(cfg, route, new Date('2026-10-01'))).toThrow(/currency/);
  });

  it('computes cost from the rate, per million tokens', () => {
    const rate = findRate(testConfig(), route, new Date('2026-10-01'));
    expect(costOf(rate, 1_000_000, 500_000)).toBe(2);
  });

  it('refuses over the input-token, per-analysis and per-tenant-month caps', () => {
    const base = {
      rate: findRate(testConfig(), route, new Date('2026-10-01')),
      estimatedInputTokens: 1000,
      maxOutputTokens: 1000,
      calls: 2,
      tenantMonthSpend: 0,
    };
    expect(checkBudget({ ...base, config: testConfig() })).toBeCloseTo(0.006);
    expect(() =>
      checkBudget({ ...base, config: testConfig({ maxInputTokensPerAnalysis: 999 }) }),
    ).toThrow(/input tokens/);
    expect(() =>
      checkBudget({ ...base, config: testConfig({ maxCostPerAnalysis: 0.001 }) }),
    ).toThrow(/per-analysis/);
    expect(() =>
      checkBudget({
        ...base,
        config: testConfig({ maxCostPerTenantMonth: 1 }),
        tenantMonthSpend: 0.999,
      }),
    ).toThrow(/monthly/);
  });
});
