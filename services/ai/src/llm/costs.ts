/**
 * Token estimate, cost ceiling and cost recording (TASK-H, PRD §26.2).
 *
 * Prices are never hard-coded: every cost comes from a timestamped rate in the AI config. A
 * call with no rate for its route, or one that would exceed a cap, is refused before any
 * network traffic.
 */
import type { AiConfig, ApprovedRoute, ModelRate } from './config.js';

export class CostCeilingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CostCeilingError';
  }
}

/**
 * Conservative token estimate: about 3 characters per token, which over-counts for English and
 * stays close for French. Used only for the pre-call check; recorded usage comes from the
 * provider's response.
 */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 3);

/** The rate in force at `at` for this route: the latest `effectiveFrom` not after `at`. */
export const findRate = (config: AiConfig, route: ApprovedRoute, at: Date): ModelRate => {
  const candidates = config.rates
    .filter(
      (r) =>
        r.provider === route.provider &&
        r.model === route.model &&
        Date.parse(r.effectiveFrom) <= at.getTime(),
    )
    .sort((a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom));
  const rate = candidates[0];
  if (!rate) {
    throw new CostCeilingError(
      `no rate configured for ${route.provider}/${route.model} at ${at.toISOString()}; refusing the call`,
    );
  }
  if (rate.currency !== config.caps.currency) {
    throw new CostCeilingError(
      `rate currency ${rate.currency} does not match cap currency ${config.caps.currency}`,
    );
  }
  return rate;
};

export const costOf = (rate: ModelRate, inputTokens: number, outputTokens: number): number =>
  (inputTokens * rate.inputPerMillionTokens + outputTokens * rate.outputPerMillionTokens) /
  1_000_000;

export interface BudgetCheck {
  readonly config: AiConfig;
  readonly rate: ModelRate;
  /** Estimated input tokens of one call. */
  readonly estimatedInputTokens: number;
  /** Output token ceiling of one call. */
  readonly maxOutputTokens: number;
  /** Most calls this analysis may make (first try plus the retry). */
  readonly calls: number;
  /** Cost already recorded for this tenant in the current calendar month. */
  readonly tenantMonthSpend: number;
}

/** Refuse the analysis when the worst case would cross a cap. Returns the worst-case cost. */
export const checkBudget = (b: BudgetCheck): number => {
  const caps = b.config.caps;
  if (b.estimatedInputTokens > caps.maxInputTokensPerAnalysis) {
    throw new CostCeilingError(
      `estimated ${b.estimatedInputTokens} input tokens exceeds the per-analysis cap of ${caps.maxInputTokensPerAnalysis}`,
    );
  }
  const worst = costOf(b.rate, b.estimatedInputTokens * b.calls, b.maxOutputTokens * b.calls);
  if (worst > caps.maxCostPerAnalysis) {
    throw new CostCeilingError(
      `worst-case cost ${worst.toFixed(4)} ${caps.currency} exceeds the per-analysis cap of ${caps.maxCostPerAnalysis}`,
    );
  }
  if (b.tenantMonthSpend + worst > caps.maxCostPerTenantMonth) {
    throw new CostCeilingError(
      `tenant monthly spend would reach ${(b.tenantMonthSpend + worst).toFixed(4)} ${caps.currency}, over the cap of ${caps.maxCostPerTenantMonth}`,
    );
  }
  return worst;
};
