/**
 * Model provider abstraction (TASK-H, PRD §10 "provider abstraction", ADR 0029).
 *
 * One small interface, three implementations that talk to a model:
 *
 * - `MockProvider`: deterministic, no network. Used by every test, the eval in CI and the
 *   prompt-injection suite (with scripted hostile outputs).
 * - `OpenAICompatibleProvider`: any OpenAI-compatible chat endpoint (EU-hosted vendor or a
 *   self-hosted server), configured by env only.
 * - `AnthropicProvider`: the Anthropic Messages API through the official SDK.
 *
 * The rule-based pipeline (`rule-based/v1`) stays the default and the fallback; it does not
 * go through this interface because it never calls a model.
 *
 * Every provider re-checks the allowlist before each call, so a provider object built for a
 * route that is later removed from the config cannot be used.
 */
import Anthropic from '@anthropic-ai/sdk';

import { assertApproved, type AiConfig, type ResolvedRoute } from './config.js';
import { fixtureResponder } from './mockResponder.js';

export interface CompletionRequest {
  readonly system: string;
  readonly user: string;
  readonly maxOutputTokens: number;
}

export interface CompletionResult {
  readonly text: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** The exact model version the provider reports it used. */
  readonly modelVersion: string;
}

export interface ModelProvider {
  readonly route: ResolvedRoute;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

/** The provider declined to answer (safety refusal). The pipeline fails closed. */
export class ProviderRefusalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderRefusalError';
  }
}

export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

export const MOCK_ROUTE: ResolvedRoute = {
  id: 'mock/fixture-v1',
  provider: 'mock',
  model: 'fixture-v1',
  region: 'local',
  baseUrl: null,
  apiKey: null,
};

export type ScriptedResponse = string | ((req: CompletionRequest, call: number) => string);

/**
 * Deterministic provider. With no script it answers with `fixtureResponder`, a heuristic that
 * reads the delimited survey data and returns grounded JSON. With a script it returns the
 * scripted outputs in order (the last one repeats), which is how the hostile-output tests
 * simulate a misbehaving model.
 */
export class MockProvider implements ModelProvider {
  readonly route: ResolvedRoute;
  readonly requests: CompletionRequest[] = [];
  private calls = 0;

  constructor(
    private readonly config: AiConfig,
    private readonly script: ReadonlyArray<ScriptedResponse> = [],
    route: ResolvedRoute = MOCK_ROUTE,
  ) {
    this.route = route;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    assertApproved(this.config, this.route);
    this.requests.push(req);
    const call = this.calls;
    this.calls += 1;
    const step =
      this.script.length > 0 ? this.script[Math.min(call, this.script.length - 1)] : null;
    const text =
      step === null || step === undefined
        ? fixtureResponder(req.user)
        : typeof step === 'function'
          ? step(req, call)
          : step;
    return {
      text,
      inputTokens: Math.ceil((req.system.length + req.user.length) / 4),
      outputTokens: Math.ceil(text.length / 4),
      modelVersion: this.route.model,
    };
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** OpenAI-compatible `/chat/completions` endpoint (EU-hosted vendor or self-hosted). */
export class OpenAICompatibleProvider implements ModelProvider {
  constructor(
    private readonly config: AiConfig,
    readonly route: ResolvedRoute,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    if (!route.baseUrl) throw new Error('openai-compatible routes need a baseUrl');
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    assertApproved(this.config, this.route);
    const url = `${(this.route.baseUrl ?? '').replace(/\/$/, '')}/chat/completions`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.route.apiKey ?? ''}`,
      },
      body: JSON.stringify({
        model: this.route.model,
        max_tokens: req.maxOutputTokens,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
      }),
    });
    if (!res.ok) {
      // Never echo the response body: some servers reflect the request (and so the data).
      throw new ProviderHttpError(`model endpoint returned HTTP ${res.status}`, res.status);
    }
    const body = (await res.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const msg = body.choices?.[0]?.message;
    if (msg?.refusal) throw new ProviderRefusalError('model refused the request');
    return {
      text: msg?.content ?? '',
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
      modelVersion: body.model ?? this.route.model,
    };
  }
}

/**
 * Anthropic Messages API. No server-side `fallbacks`: a fallback would answer with a model that
 * is not on the allowlist, so a refusal fails closed instead.
 */
export class AnthropicProvider implements ModelProvider {
  private readonly client: Pick<Anthropic, 'messages'>;

  constructor(
    private readonly config: AiConfig,
    readonly route: ResolvedRoute,
    client?: Pick<Anthropic, 'messages'>,
  ) {
    this.client =
      client ??
      new Anthropic({
        apiKey: route.apiKey ?? undefined,
        ...(route.baseUrl ? { baseURL: route.baseUrl } : {}),
      });
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    assertApproved(this.config, this.route);
    const res = await this.client.messages.create({
      model: this.route.model,
      max_tokens: req.maxOutputTokens,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
    });
    if (res.stop_reason === 'refusal') throw new ProviderRefusalError('model refused the request');
    const text = res.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('')
      .trim();
    return {
      text,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      modelVersion: res.model,
    };
  }
}

/** Build the provider for a resolved route. `rule-based` has none (it never calls a model). */
export const createProvider = (config: AiConfig, route: ResolvedRoute): ModelProvider | null => {
  switch (route.provider) {
    case 'rule-based':
      return null;
    case 'mock':
      return new MockProvider(config, [], route);
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config, route);
    case 'anthropic':
      return new AnthropicProvider(config, route);
  }
};
