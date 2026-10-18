import { describe, expect, it } from 'vitest';
import { CostCeilingError } from './costs.js';
import { OutputValidationError, runLlmPipeline, TenantIsolationError } from './llmPipeline.js';
import type { AiLogEvent } from './log.js';
import { MockProvider } from './providers.js';
import { TENANT_B, testConfig, textSubmission } from './testFixtures.js';

const ANSWERS = [
  {
    id: 'ans-1',
    axis: 'practice',
    question: 'What takes your time?',
    text: 'I copy and paste supplier data into the sheet every Monday. It takes about 3 hours.',
  },
  {
    id: 'ans-2',
    axis: 'literacy',
    question: 'How do you check AI answers?',
    text: 'I always check the numbers against the source file.',
  },
  {
    id: 'ans-3',
    axis: 'readiness',
    question: 'Anything else?',
    text: 'Write to Zorblat Quenneville at zorblat.q@synthetic.invalid if needed.',
  },
];

const fixedNow = () => new Date('2026-10-15T10:00:00Z');

describe('runLlmPipeline on the mock provider', () => {
  it('produces a grounded draft with metadata', async () => {
    const provider = new MockProvider(testConfig());
    const res = await runLlmPipeline(textSubmission(ANSWERS), {
      provider,
      config: testConfig(),
      tenantNames: ['Zorblat Quenneville'],
      now: fixedNow,
    });
    const p = res.payload;
    expect(p.version).toBe(2);
    expect(p.aiDraft).toBe(true);
    expect(p.sensitivity).toBe('sensitive');
    expect(p.themes.map((t) => t.id)).toEqual(
      expect.arrayContaining(['repetitive-work', 'checking-output']),
    );
    for (const c of p.evidence) {
      const src = ANSWERS.find((a) => a.id === c.sourceId);
      expect(src?.text).toContain(c.quote);
    }
    expect(p.unsupported).toEqual([]);
    expect(p.opportunities?.length).toBeGreaterThan(0);
    const withNumber = p.facts?.find((f) => f.number);
    expect(withNumber?.number).toMatchObject({ value: '3', selfReported: true });
    expect(res.meta).toMatchObject({
      routeId: 'mock/fixture-v1',
      provider: 'mock',
      model: 'fixture-v1',
      region: 'local',
      promptVersion: 'synthesis-v1',
      currency: 'EUR',
      attempts: 1,
      rateEffectiveFrom: '2026-01-01T00:00:00Z',
    });
    expect(res.meta.inputRecordIds).toEqual(
      expect.arrayContaining(['ans-1', 'ans-2', 'ans-3', 'q-ans-1']),
    );
    expect(res.meta.inputTokens).toBeGreaterThan(0);
    expect(res.meta.cost).toBeGreaterThan(0);
  });

  it('sends no personal data to the model and restores it in the draft', async () => {
    const provider = new MockProvider(testConfig());
    const res = await runLlmPipeline(textSubmission(ANSWERS), {
      provider,
      config: testConfig(),
      tenantNames: ['Zorblat Quenneville'],
      now: fixedNow,
    });
    const sent = provider.requests.map((r) => r.system + r.user).join('\n');
    expect(sent).not.toMatch(/Zorblat|Quenneville|synthetic\.invalid/);
    expect(sent).toContain('[NAME_1]');
    const fact = res.payload.facts?.find((f) => f.sourceId === 'ans-3');
    expect(fact?.quote).toContain('Zorblat Quenneville');
  });

  it('refuses input that mixes tenants, before any call', async () => {
    const provider = new MockProvider(testConfig());
    const input = textSubmission(ANSWERS);
    const mixed = {
      ...input,
      answers: [...input.answers, { ...input.answers[0]!, id: 'other', tenant_id: TENANT_B }],
    };
    await expect(runLlmPipeline(mixed, { provider, config: testConfig() })).rejects.toBeInstanceOf(
      TenantIsolationError,
    );
    const noIds = {
      ...input,
      answers: input.answers.map(({ tenant_id: _t, ...rest }) => rest),
    };
    await expect(runLlmPipeline(noIds, { provider, config: testConfig() })).rejects.toBeInstanceOf(
      TenantIsolationError,
    );
    expect(provider.requests).toHaveLength(0);
  });

  it('refuses over the cost ceiling, before any call', async () => {
    const provider = new MockProvider(testConfig());
    await expect(
      runLlmPipeline(textSubmission(ANSWERS), {
        provider,
        config: testConfig({ maxCostPerTenantMonth: 1 }),
        tenantMonthSpend: 1,
        now: fixedNow,
      }),
    ).rejects.toBeInstanceOf(CostCeilingError);
    expect(provider.requests).toHaveLength(0);
  });

  it('retries once on invalid output, then succeeds', async () => {
    const provider = new MockProvider(testConfig(), [
      'not json',
      '{"facts":[],"themes":[],"contradictions":[],"interviewQuestions":[],"opportunities":[]}',
    ]);
    const res = await runLlmPipeline(textSubmission(ANSWERS), {
      provider,
      config: testConfig(),
      now: fixedNow,
    });
    expect(res.meta.attempts).toBe(2);
    expect(provider.requests[1]?.user).toContain('previous answer was rejected');
  });

  it('fails closed after a second invalid output', async () => {
    const provider = new MockProvider(testConfig(), ['not json', '{"facts":"x"}']);
    await expect(
      runLlmPipeline(textSubmission(ANSWERS), { provider, config: testConfig(), now: fixedNow }),
    ).rejects.toBeInstanceOf(OutputValidationError);
    expect(provider.requests).toHaveLength(2);
  });

  it('logs ids and counts only, never answer or prompt text', async () => {
    const events: AiLogEvent[] = [];
    const provider = new MockProvider(testConfig(), [
      '{"facts":[{"id":"f1","statement":"supplier data","sourceId":"ans-1"}]}',
      'still bad',
    ]);
    await runLlmPipeline(textSubmission(ANSWERS), {
      provider,
      config: testConfig(),
      now: fixedNow,
      log: (e) => events.push(e),
    }).catch(() => undefined);
    const logged = JSON.stringify(events);
    expect(events.map((e) => e.event)).toEqual([
      'ai.call',
      'ai.invalid-output',
      'ai.call',
      'ai.invalid-output',
      'ai.failed-closed',
    ]);
    for (const a of ANSWERS) expect(logged).not.toContain(a.text.slice(0, 20));
    expect(logged).not.toMatch(/supplier|Zorblat|synthetic\.invalid/);
  });

  it('writes in French for a French submission', async () => {
    const res = await runLlmPipeline(
      textSubmission(
        [
          {
            id: 'fr-1',
            axis: 'practice',
            question: 'Quoi ?',
            text: 'Je recopie les factures à la main chaque semaine.',
          },
        ],
        { locale: 'fr' },
      ),
      { provider: new MockProvider(testConfig()), config: testConfig(), now: fixedNow },
    );
    expect(res.payload.themes.map((t) => t.label)).toContain('Tâches répétitives');
  });
});
