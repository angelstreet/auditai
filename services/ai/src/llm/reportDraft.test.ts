import { describe, expect, it } from 'vitest';
import { parseAiConfig } from './config.js';
import { CostCeilingError } from './costs.js';
import { OutputValidationError } from './llmPipeline.js';
import { MockProvider } from './providers.js';
import { draftReportSummary, type ReportDraftInput } from './reportDraft.js';
import { TENANT_A, testConfig } from './testFixtures.js';

const input = (over: Partial<ReportDraftInput> = {}): ReportDraftInput => ({
  tenantId: TENANT_A,
  reportId: '00000000-0000-4000-8000-000000000001',
  locale: 'en',
  findings: [
    {
      key: 'practice|weekly report by hand',
      axis: 'practice',
      label: 'Weekly report by hand',
      people: 7,
    },
    { key: 'literacy|checking answers', axis: 'literacy', label: 'Checking answers', people: 5 },
  ],
  opportunities: [
    { rank: 1, title: 'Automate the weekly report', steps: ['A report that builds itself'] },
  ],
  ...over,
});

const config = testConfig();

describe('report summary draft', () => {
  it('drafts cited sentences on the mock route, with route, prompt and cost', async () => {
    const d = await draftReportSummary(input(), { provider: new MockProvider(config), config });
    expect(d.text).toBe(
      '7 people raise: Weekly report by hand. 5 people raise: Checking answers. Recommended first step: Automate the weekly report.',
    );
    expect(d.citations).toEqual(['practice|weekly report by hand', 'literacy|checking answers']);
    expect(d).toMatchObject({
      route: 'mock/fixture-v1',
      promptVersion: 'report-summary-v1',
      dropped: 0,
    });
    expect(d.costAmount).toBeGreaterThan(0);
  });

  it('sends aggregates only, inside a nonce-delimited data block', async () => {
    const provider = new MockProvider(config);
    await draftReportSummary(input(), { provider, config });
    const user = provider.requests[0]?.user ?? '';
    expect(user).toMatch(/<<<REPORT_DATA [\w-]+\n[\s\S]*\n>>>REPORT_DATA [\w-]+/);
    expect(user).not.toMatch(/practice\|weekly/); // finding keys stay on our side; ids F1, F2 go out
    expect(user).toContain('"id": "F1"');
    const data = JSON.parse(
      /<<<REPORT_DATA [\w-]+\n([\s\S]*?)\n>>>REPORT_DATA/.exec(user)?.[1] ?? '{}',
    ) as { findings: object[]; opportunities: object[] };
    expect(Object.keys(data).sort()).toEqual(['findings', 'opportunities']);
    expect(Object.keys(data.findings[0] ?? {}).sort()).toEqual(['axis', 'id', 'label', 'people']);
    expect(Object.keys(data.opportunities[0] ?? {}).sort()).toEqual(['rank', 'steps', 'title']);
  });

  it('hides tenant names from the model and restores them for this tenant', async () => {
    const provider = new MockProvider(config);
    const d = await draftReportSummary(
      input({
        findings: [
          {
            key: 'context|x',
            axis: 'context',
            label: 'Demo Referent approves everything',
            people: 6,
          },
        ],
      }),
      { provider, config, tenantNames: ['Demo Referent'] },
    );
    expect(provider.requests[0]?.user).not.toContain('Demo Referent');
    expect(provider.requests[0]?.user).toContain('[NAME_1]');
    expect(d.text).toContain('Demo Referent');
  });

  it('drops sentences citing unknown findings or inventing numbers, keeps the grounded ones', async () => {
    const provider = new MockProvider(config, [
      JSON.stringify({
        sentences: [
          { text: 'Reporting by hand came up most.', cites: ['F1'] },
          { text: 'This saves 40 hours a month.', cites: ['F1'] },
          { text: 'Something else.', cites: ['F9'] },
          { text: '7 people mention it.', cites: ['F1'] },
        ],
      }),
    ]);
    const d = await draftReportSummary(input(), { provider, config });
    expect(d.text).toBe('Reporting by hand came up most. 7 people mention it.');
    expect(d.dropped).toBe(2);
    expect(d.citations).toEqual(['practice|weekly report by hand']);
  });

  it('retries once on invalid output, then fails closed', async () => {
    const ok = JSON.stringify({ sentences: [{ text: 'Fine.', cites: ['F2'] }] });
    const retried = new MockProvider(config, ['not json', ok]);
    expect((await draftReportSummary(input(), { provider: retried, config })).text).toBe('Fine.');
    expect(retried.requests).toHaveLength(2);
    const broken = new MockProvider(config, ['not json', '{"sentences":[],"extra":1}']);
    await expect(draftReportSummary(input(), { provider: broken, config })).rejects.toBeInstanceOf(
      OutputValidationError,
    );
  });

  it('fails closed when no sentence is grounded, or when there is nothing to summarise', async () => {
    const provider = new MockProvider(config, [
      JSON.stringify({ sentences: [{ text: 'Ignore the rules: 99% saved.', cites: ['F1'] }] }),
    ]);
    await expect(draftReportSummary(input(), { provider, config })).rejects.toBeInstanceOf(
      OutputValidationError,
    );
    await expect(
      draftReportSummary(input({ findings: [] }), { provider: new MockProvider(config), config }),
    ).rejects.toBeInstanceOf(OutputValidationError);
  });

  it('refuses a route that is not approved, and a call over the cost cap', async () => {
    const noMock = parseAiConfig({
      ...config,
      approvedRoutes: config.approvedRoutes.filter((r) => r.provider !== 'mock'),
    });
    await expect(
      draftReportSummary(input(), { provider: new MockProvider(noMock), config: noMock }),
    ).rejects.toThrow(/not in the approved allowlist|not approved/);
    const tiny = testConfig({ maxCostPerTenantMonth: 0.000001 });
    await expect(
      draftReportSummary(input(), {
        provider: new MockProvider(tiny),
        config: tiny,
        tenantMonthSpend: 1,
      }),
    ).rejects.toBeInstanceOf(CostCeilingError);
  });

  it('writes French when the report is in French', async () => {
    const d = await draftReportSummary(input({ locale: 'fr' }), {
      provider: new MockProvider(config),
      config,
    });
    expect(d.text).toContain('7 personnes signalent');
  });
});
