import { describe, expect, it } from 'vitest';
import {
  competencyAxisSchema,
  questionItemSchema,
  questionnaireVersionSchema,
  questionKindSchema,
  templateSchema,
} from './template.js';

const ISO = '2026-10-14T19:00:00.000Z';
const TENANT = '550e8400-e29b-41d4-a716-446655440000';
const TPL = '550e8400-e29b-41d4-a716-446655440001';
const ITEM = '550e8400-e29b-41d4-a716-446655440002';
const VER = '550e8400-e29b-41d4-a716-446655440003';

const baseItem = {
  id: ITEM,
  tenantId: TENANT,
  axis: 'literacy' as const,
  code: 'verification_basics',
  kind: 'scenario_choice' as const,
  locale: 'fr' as const,
  prompt: 'Un assistant produit une affirmation de politique non sourc\u00e9e. Que faites-vous ?',
  helper: 'Pensez \u00e0 la source autoritaire.',
  options: [
    { value: 'use_it', label: 'Utiliser la r\u00e9ponse telle quelle' },
    { value: 'check_source', label: 'V\u00e9rifier une source autoritaire' },
  ],
  scoring: { weight: 1, reverse: false },
  sensitivity: 'internal' as const,
  retestable: true,
  createdAt: ISO,
  updatedAt: null,
};

describe('questionItemSchema', () => {
  it('parses a valid question item', () => {
    const q = questionItemSchema.parse(baseItem);
    expect(q.options).toHaveLength(2);
    expect(q.scoring.weight).toBe(1);
  });

  it('requires snake_case item codes starting with a letter', () => {
    expect(() => questionItemSchema.parse({ ...baseItem, code: '1bad' })).toThrow();
    expect(() => questionItemSchema.parse({ ...baseItem, code: 'Has-Capitals' })).toThrow();
    expect(() => questionItemSchema.parse({ ...baseItem, code: 'ok_code' })).not.toThrow();
  });

  it('caps the number of options at 10', () => {
    const options = Array.from({ length: 11 }, (_, i) => ({
      value: `v${i}`,
      label: `Label ${i}`,
    }));
    expect(() => questionItemSchema.parse({ ...baseItem, options })).toThrow();
  });

  it('requires scoring.weight within 0\u20131', () => {
    expect(() =>
      questionItemSchema.parse({ ...baseItem, scoring: { weight: -0.1, reverse: false } }),
    ).toThrow();
    expect(() =>
      questionItemSchema.parse({ ...baseItem, scoring: { weight: 1.1, reverse: false } }),
    ).toThrow();
  });

  it('rejects non-supported sensitivity levels', () => {
    expect(() => questionItemSchema.parse({ ...baseItem, sensitivity: 'public_secret' })).toThrow();
  });

  it('exposes the canonical question kinds', () => {
    expect([...questionKindSchema.options].sort()).toEqual([
      'boolean',
      'multi_choice',
      'scale_5',
      'scenario_choice',
      'short_text',
      'single_choice',
    ]);
  });

  it('exposes the canonical competency axes', () => {
    expect([...competencyAxisSchema.options].sort()).toEqual([
      'context',
      'literacy',
      'opportunity',
      'practice',
      'readiness',
    ]);
  });
});

describe('questionnaireVersionSchema', () => {
  const validVersion = {
    id: VER,
    tenantId: TENANT,
    templateId: TPL,
    versionNumber: 1,
    itemIds: [ITEM],
    translations: {},
    sourceLocale: 'fr' as const,
    frozenAt: ISO,
    changeNote: 'initial freeze',
  };

  it('parses a valid version', () => {
    const v = questionnaireVersionSchema.parse(validVersion);
    expect(v.versionNumber).toBe(1);
  });

  it('requires monotonically increasing version numbers per template', () => {
    expect(() => questionnaireVersionSchema.parse({ ...validVersion, versionNumber: 0 })).toThrow();
    expect(() =>
      questionnaireVersionSchema.parse({ ...validVersion, versionNumber: 2000 }),
    ).toThrow();
  });

  it('requires at least one item', () => {
    expect(() => questionnaireVersionSchema.parse({ ...validVersion, itemIds: [] })).toThrow();
  });

  it('caps the version at 200 items', () => {
    const tooMany = Array.from({ length: 201 }, () => ITEM);
    expect(() => questionnaireVersionSchema.parse({ ...validVersion, itemIds: tooMany })).toThrow();
  });
});

describe('templateSchema', () => {
  const validTemplate = {
    id: TPL,
    tenantId: TENANT,
    name: 'Pilot calibration v1',
    ownerUserId: null,
    defaultLocale: 'fr' as const,
    createdAt: ISO,
    updatedAt: null,
  };

  it('parses a valid template', () => {
    const t = templateSchema.parse(validTemplate);
    expect(t.ownerUserId).toBeNull();
  });
});
