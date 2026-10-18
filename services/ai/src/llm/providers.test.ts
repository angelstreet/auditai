import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { parseAiConfig, RouteNotApprovedError, type ResolvedRoute } from './config.js';
import {
  AnthropicProvider,
  createProvider,
  MockProvider,
  MOCK_ROUTE,
  OpenAICompatibleProvider,
  ProviderHttpError,
  ProviderRefusalError,
} from './providers.js';
import { testConfig } from './testFixtures.js';

const openaiRoute: ResolvedRoute = {
  id: 'openai-compatible/example-model',
  provider: 'openai-compatible',
  model: 'example-model',
  region: 'eu-example',
  baseUrl: 'https://llm.example.test/v1/',
  apiKey: 'test-key',
};
const anthropicRoute: ResolvedRoute = {
  ...openaiRoute,
  id: 'anthropic/example-model',
  provider: 'anthropic',
  baseUrl: 'https://llm.example.test',
};
const cfg = parseAiConfig({
  ...testConfig(),
  approvedRoutes: [
    ...testConfig().approvedRoutes,
    {
      provider: 'openai-compatible',
      model: 'example-model',
      region: 'eu-example',
      baseUrl: openaiRoute.baseUrl,
    },
    {
      provider: 'anthropic',
      model: 'example-model',
      region: 'eu-example',
      baseUrl: anthropicRoute.baseUrl,
    },
  ],
});
const req = { system: 'sys', user: 'usr', maxOutputTokens: 100 };

describe('OpenAI-compatible provider', () => {
  it('posts a chat completion and reads text and usage', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const p = new OpenAICompatibleProvider(cfg, openaiRoute, async (url, init) => {
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          model: 'example-model-2026',
          choices: [{ message: { content: '{"ok":1}' } }],
          usage: { prompt_tokens: 11, completion_tokens: 7 },
        }),
      );
    });
    const res = await p.complete(req);
    expect(res).toEqual({
      text: '{"ok":1}',
      inputTokens: 11,
      outputTokens: 7,
      modelVersion: 'example-model-2026',
    });
    expect(calls[0]?.url).toBe('https://llm.example.test/v1/chat/completions');
    const body = JSON.parse(String(calls[0]?.init.body)) as { model: string; messages: unknown[] };
    expect(body.model).toBe('example-model');
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ]);
  });

  it('does not echo the response body on HTTP errors', async () => {
    const p = new OpenAICompatibleProvider(
      cfg,
      openaiRoute,
      async () => new Response('echo of usr data', { status: 500 }),
    );
    const err = await p.complete(req).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderHttpError);
    expect(String((err as Error).message)).not.toContain('usr');
  });

  it('fails closed on a refusal', async () => {
    const p = new OpenAICompatibleProvider(
      cfg,
      openaiRoute,
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: null, refusal: 'no' } }] })),
    );
    await expect(p.complete(req)).rejects.toBeInstanceOf(ProviderRefusalError);
  });

  it('refuses to call once its route leaves the allowlist', async () => {
    const p = new OpenAICompatibleProvider(testConfig(), openaiRoute, async () => {
      throw new Error('network must not be reached');
    });
    await expect(p.complete(req)).rejects.toBeInstanceOf(RouteNotApprovedError);
  });
});

describe('Anthropic provider', () => {
  const fakeClient = (res: unknown, seen: unknown[] = []) =>
    ({
      messages: {
        create: async (params: unknown) => {
          seen.push(params);
          return res;
        },
      },
    }) as unknown as Pick<Anthropic, 'messages'>;

  it('sends model, system and user, and reads text blocks and usage', async () => {
    const seen: unknown[] = [];
    const p = new AnthropicProvider(
      cfg,
      anthropicRoute,
      fakeClient(
        {
          model: 'example-model',
          stop_reason: 'end_turn',
          content: [
            { type: 'thinking', thinking: '' },
            { type: 'text', text: '{"a":' },
            { type: 'text', text: '1}' },
          ],
          usage: { input_tokens: 5, output_tokens: 3 },
        },
        seen,
      ),
    );
    expect(await p.complete(req)).toEqual({
      text: '{"a":1}',
      inputTokens: 5,
      outputTokens: 3,
      modelVersion: 'example-model',
    });
    expect(seen[0]).toEqual({
      model: 'example-model',
      max_tokens: 100,
      system: 'sys',
      messages: [{ role: 'user', content: 'usr' }],
    });
  });

  it('fails closed on a refusal stop reason', async () => {
    const p = new AnthropicProvider(
      cfg,
      anthropicRoute,
      fakeClient({
        model: 'x',
        stop_reason: 'refusal',
        content: [],
        usage: { input_tokens: 1, output_tokens: 0 },
      }),
    );
    await expect(p.complete(req)).rejects.toBeInstanceOf(ProviderRefusalError);
  });
});

describe('provider factory and mock', () => {
  it('builds no provider for rule-based and a mock for mock', () => {
    expect(
      createProvider(cfg, {
        ...MOCK_ROUTE,
        id: 'rule-based/v1',
        provider: 'rule-based',
        model: 'v1',
      }),
    ).toBeNull();
    expect(createProvider(cfg, MOCK_ROUTE)).toBeInstanceOf(MockProvider);
    expect(createProvider(cfg, openaiRoute)).toBeInstanceOf(OpenAICompatibleProvider);
    expect(createProvider(cfg, anthropicRoute)).toBeInstanceOf(AnthropicProvider);
  });

  it('replays a script in order and repeats the last entry', async () => {
    const p = new MockProvider(cfg, ['a', (_r, n) => `call-${n}`]);
    expect((await p.complete(req)).text).toBe('a');
    expect((await p.complete(req)).text).toBe('call-1');
    expect((await p.complete(req)).text).toBe('call-2');
    expect(p.requests).toHaveLength(3);
  });
});
