import { z } from 'zod';

/** Sensitivity classification (PRD §10). `sensitive` items are excluded from free-text exports. */
export const sensitivitySchema = z.enum(['public', 'internal', 'sensitive']);
export type Sensitivity = z.infer<typeof sensitivitySchema>;

import {
  isoDateTimeSchema,
  localeSchema,
  questionnaireVersionIdSchema,
  questionItemIdSchema,
  templateIdSchema,
  tenantIdSchema,
} from './ids.js';

/**
 * Survey template and versions \u2014 PRD \u00a76.1 / \u00a714.
 *
 * A template is the named, tenant-scoped editor object. A questionnaire version is an immutable
 * snapshot of a template's items at a point in time. Field engagements always point to a specific
 * version so historical comparisons stay valid (PRD \u00a717).
 */

export const templateSchema = z.object({
  id: templateIdSchema,
  tenantId: tenantIdSchema,
  name: z.string().min(1).max(120),
  /** Owner of the template inside the consultancy. Null when owned by the platform. */
  ownerUserId: z.string().uuid().nullable(),
  /** Default locale for the template; per-version overrides apply for translations. */
  defaultLocale: localeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema.nullable(),
});

export type Template = z.infer<typeof templateSchema>;

/**
 * Question kinds \u2014 we model only the formats the mobile UI uses at MVP. Adding a new format
 * requires a calibration item type, a scoring rule and a UI component in @auditai/ui.
 */
export const questionKindSchema = z.enum([
  'single_choice',
  'multi_choice',
  'short_text',
  'scale_5',
  'boolean',
  'scenario_choice',
]);
export type QuestionKind = z.infer<typeof questionKindSchema>;

/** Axes the question contributes to (PRD \u00a76). */
export const competencyAxisSchema = z.enum([
  'literacy',
  'practice',
  'readiness',
  'opportunity',
  'context',
]);
export type CompetencyAxis = z.infer<typeof competencyAxisSchema>;

/**
 * Question item \u2014 the actual content. Each item carries its own scoring rubric so a deterministic
 * scorer can map a response to a proficiency level (PRD \u00a76.1, \u00a76.3).
 */
export const questionItemSchema = z.object({
  id: questionItemIdSchema,
  tenantId: tenantIdSchema,
  /** The competency axis this item contributes to. */
  axis: competencyAxisSchema,
  /** Stable code the scoring version references; never reused across versions. */
  code: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, 'must be snake_case starting with a letter'),
  kind: questionKindSchema,
  /** Locale the text below is written in. */
  locale: localeSchema,
  /** The actual question text. */
  prompt: z.string().min(1).max(500),
  /** Optional helper copy shown beneath the prompt. */
  helper: z.string().max(500).nullable(),
  /** For single/multi/scenario choice questions, the option labels. */
  options: z
    .array(
      z.object({
        value: z.string().min(1).max(40),
        label: z.string().min(1).max(200),
      }),
    )
    .max(10)
    .default([]),
  /** The value mapping to a 0\u20131 proficiency on this axis (PRD \u00a76). */
  scoring: z.object({
    weight: z.number().min(0).max(1),
    /** Optional reverse scoring for negatively-keyed items. */
    reverse: z.boolean().default(false),
  }),
  /** Sensitivity classification (PRD \u00a710). `sensitive` items are excluded from free-text exports. */
  sensitivity: sensitivitySchema,
  /** Marks whether the item is in the rotation pool (used for retest/follow-up). */
  retestable: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema.nullable(),
});

export type QuestionItem = z.infer<typeof questionItemSchema>;

/**
 * Questionnaire version \u2014 an immutable, ordered snapshot of a template at a point in time. Field
 * engagements always bind to one of these.
 */
export const questionnaireVersionSchema = z.object({
  id: questionnaireVersionIdSchema,
  tenantId: tenantIdSchema,
  templateId: templateIdSchema,
  /** Monotonic per template; never reused. */
  versionNumber: z.number().int().min(1).max(1000),
  /** The ordered list of items shown in this version. */
  itemIds: z.array(questionItemIdSchema).min(1).max(200),
  /** Locale-specific overrides for prompts; used when a translation diverges. */
  translations: z
    .record(
      localeSchema,
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(1000),
      }),
    )
    .default({}),
  /** Locale the version was authored in. */
  sourceLocale: localeSchema,
  /** ISO timestamp; the moment the snapshot was frozen. */
  frozenAt: isoDateTimeSchema,
  /** Optional change log entry \u2014 free-text explanation of what changed since the previous version. */
  changeNote: z.string().max(2000).nullable(),
});

export type QuestionnaireVersion = z.infer<typeof questionnaireVersionSchema>;
