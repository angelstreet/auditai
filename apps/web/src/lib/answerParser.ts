import type { AnswerValue } from '@evolai/contracts';
import { PILOT_QUESTIONNAIRE } from '@evolai/contracts';
import type { SurveyQuestion } from './syntheticTemplate';

/**
 * Map the form payload into the typed `AnswerValue` stored in `answers.value_json`. A choice is
 * the option `value` string (`rationale`, when given, must already be anonymised). Free text is
 * the person's words, already anonymised by the caller. Throws on empty text so the route can
 * answer 400.
 */
export const parseAnswerValue = (
  kind: SurveyQuestion['kind'],
  input: string,
  rationale: string | null = null,
): AnswerValue => {
  if (kind === 'scenario_choice') {
    return { kind: 'scenario_choice', choice: input, rationale };
  }
  if (kind === 'single_choice') {
    return { kind: 'single_choice', choice: input };
  }
  const text = input.trim();
  if (text.length === 0) throw new Error('free text is empty');
  return { kind: 'short_text', text };
};

/**
 * True when `input` is one of the question's own option values (choices), or a non-empty text of
 * at most the questionnaire's limit (free text).
 */
export const isAllowedInput = (q: SurveyQuestion, input: string): boolean => {
  if (q.kind !== 'short_text') return q.options.some((o) => o.value === input);
  const length = input.trim().length;
  return length > 0 && length <= PILOT_QUESTIONNAIRE.freeTextMaxLength;
};
