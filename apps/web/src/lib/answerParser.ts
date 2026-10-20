import type { AnswerValue } from '@evolai/contracts';
import type { SurveyQuestion } from './syntheticTemplate';

/**
 * Map the synthetic form payload (an option `value` string) into the typed `AnswerValue` the
 * M4 `answers.value_json` column stores. `rationale` must already be anonymised. M5 keeps the synthetic format as-is; Phase 2 will
 * validate against the full Zod schema in \`@evolai/contracts\`.
 */
export const parseAnswerValue = (
  kind: SurveyQuestion['kind'],
  choice: string,
  rationale: string | null = null,
): AnswerValue => {
  if (kind === 'scenario_choice') {
    return { kind: 'scenario_choice', choice, rationale };
  }
  // The synthetic template only emits scenario_choice; the other kinds are reserved for Phase 2.
  throw new Error(`unsupported question kind in M5: ${kind}`);
};
