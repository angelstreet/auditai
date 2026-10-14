import {
  type QuestionnaireVersion,
  type QuestionItem,
  type Template,
  questionnaireVersionIdSchema,
} from '@auditai/contracts';
import { DomainError } from './ids.js';

/**
 * Template versioning helpers \u2014 PRD \u00a717 (\"Version survey item banks so longitudinal comparisons are
 * reproducible\").
 *
 * We freeze every published questionnaire version and gate longitudinal comparisons on shared
 * item codes. Two versions are *comparable* if they contain at least one item code that exists
 * in both and is marked `retestable`.
 */

export const freezeQuestionnaireVersion = (params: {
  template: Template;
  versionNumber: number;
  items: ReadonlyArray<QuestionItem>;
  sourceLocale: QuestionnaireVersion['sourceLocale'];
  translations?: QuestionnaireVersion['translations'];
  changeNote?: string | null;
  frozenAt: string;
}): QuestionnaireVersion => {
  if (params.versionNumber < 1) {
    throw new DomainError('invalid_version', 'versionNumber must be >= 1');
  }
  if (params.items.length === 0) {
    throw new DomainError('empty_version', 'cannot freeze a version with zero items');
  }
  // Stable item order \u2014 sort by code so two builds of the same content produce the same id set.
  const sorted = [...params.items].sort((a, b) => a.code.localeCompare(b.code));
  return {
    id: questionnaireVersionIdSchema.parse(crypto.randomUUID()),
    tenantId: params.template.tenantId,
    templateId: params.template.id,
    versionNumber: params.versionNumber,
    itemIds: sorted.map((i) => i.id),
    translations: params.translations ?? {},
    sourceLocale: params.sourceLocale,
    frozenAt: params.frozenAt,
    changeNote: params.changeNote ?? null,
  };
};

/**
 * `comparableItems` returns the intersection of `retestable` items between two versions. The
 * auditor UI uses this list to compute change scores.
 */
export const comparableItems = (
  a: ReadonlyMap<string, QuestionItem>,
  b: ReadonlyMap<string, QuestionItem>,
): ReadonlyArray<QuestionItem> => {
  const out: QuestionItem[] = [];
  for (const [code, itemA] of a) {
    if (!itemA.retestable) continue;
    const itemB = b.get(code);
    if (itemB && itemB.retestable) out.push(itemB);
  }
  return out;
};
