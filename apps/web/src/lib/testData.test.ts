import { describe, expect, it, vi } from 'vitest';

vi.mock('./db', () => ({ withServiceAccount: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }) }));

const { isTestSlug, listableIds, realFirst } = await import('./testData');

/** TASK-AD2: synthetic organisations are not listed next to real clients unless asked. */
describe('test data', () => {
  const test = new Set(['syn-a', 'syn-b']);
  it('recognises the seed naming', () => {
    expect(isTestSlug('synthetic-tenant-a')).toBe(true);
    expect(isTestSlug('demo-client')).toBe(false);
  });
  it('hides test organisations when a real one exists, unless shown', () => {
    expect(listableIds(['syn-a', 'real', 'syn-b'], test, false)).toEqual(['real']);
    expect(listableIds(['syn-a', 'real'], test, true)).toEqual(['syn-a', 'real']);
  });
  it('keeps them when nothing else would be left', () => {
    expect(listableIds(['syn-a', 'syn-b'], test, false)).toEqual(['syn-a', 'syn-b']);
  });
  it('puts real organisations first without dropping any', () => {
    expect(realFirst(['syn-a', 'real', 'syn-b'], test)).toEqual(['real', 'syn-a', 'syn-b']);
  });
});
