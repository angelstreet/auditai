import { describe, expect, it } from 'vitest';
import { comparableItems, freezeQuestionnaireVersion } from './template-versioning.js';
import { DomainError, parseQuestionItemId, parseTemplateId } from './ids.js';
import type { QuestionItem, Template, TenantId } from '@evolai/contracts';

const TENANT = '550e8400-e29b-41d4-a716-446655440000' as TenantId;
const TPL_ID = parseTemplateId('550e8400-e29b-41d4-a716-446655440001');
const ITEM_A = parseQuestionItemId('550e8400-e29b-41d4-a716-446655440010');
const ITEM_B = parseQuestionItemId('550e8400-e29b-41d4-a716-446655440011');

const template: Template = {
  id: TPL_ID,
  tenantId: TENANT,
  name: 'Pilot calibration v1',
  ownerUserId: null,
  defaultLocale: 'fr',
  createdAt: '2026-10-14T19:00:00.000Z',
  updatedAt: null,
};

const baseItem = (code: string, retestable: boolean): QuestionItem => ({
  id: code === 'a' ? ITEM_A : ITEM_B,
  tenantId: TENANT,
  axis: 'literacy',
  code,
  kind: 'scenario_choice',
  locale: 'fr',
  prompt: code,
  helper: null,
  options: [
    { value: 'low', label: 'low' },
    { value: 'high', label: 'high' },
  ],
  scoring: { weight: 1, reverse: false },
  sensitivity: 'internal',
  retestable,
  createdAt: '2026-10-14T19:00:00.000Z',
  updatedAt: null,
});

describe('freezeQuestionnaireVersion', () => {
  it('rejects empty item lists', () => {
    expect(() =>
      freezeQuestionnaireVersion({
        template,
        versionNumber: 1,
        items: [],
        sourceLocale: 'fr',
        frozenAt: '2026-10-14T19:00:00.000Z',
      }),
    ).toThrow(DomainError);
  });

  it('rejects versionNumber < 1', () => {
    expect(() =>
      freezeQuestionnaireVersion({
        template,
        versionNumber: 0,
        items: [baseItem('a', true)],
        sourceLocale: 'fr',
        frozenAt: '2026-10-14T19:00:00.000Z',
      }),
    ).toThrow(DomainError);
  });

  it('produces a deterministic id list sorted by code', () => {
    const v = freezeQuestionnaireVersion({
      template,
      versionNumber: 1,
      items: [baseItem('b', true), baseItem('a', true)],
      sourceLocale: 'fr',
      frozenAt: '2026-10-14T19:00:00.000Z',
    });
    expect(v.itemIds).toEqual([ITEM_A, ITEM_B]);
    expect(v.templateId).toBe(template.id);
  });
});

describe('comparableItems', () => {
  it('returns items shared between two versions, retestable only', () => {
    const mapA = new Map<string, QuestionItem>([
      ['a', baseItem('a', true)],
      ['b', baseItem('b', false)], // not retestable
    ]);
    const mapB = new Map<string, QuestionItem>([
      ['a', baseItem('a', true)],
      ['b', baseItem('b', true)],
      ['c', baseItem('c', true)], // not in A
    ]);
    const shared = comparableItems(mapA, mapB);
    expect(shared).toHaveLength(1);
    expect(shared[0]?.code).toBe('a');
  });

  it('returns the empty list when no items overlap', () => {
    const mapA = new Map<string, QuestionItem>([['a', baseItem('a', true)]]);
    const mapB = new Map<string, QuestionItem>([['b', baseItem('b', true)]]);
    expect(comparableItems(mapA, mapB)).toEqual([]);
  });
});
