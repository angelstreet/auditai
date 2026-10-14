import { describe, expect, it } from 'vitest';
import {
  brandedId,
  isUuidV4,
  localeSchema,
  paginationCursorSchema,
  respondentPseudonymSchema,
  ulidRegex,
  uuidV4Schema,
} from './ids.js';

const UUID_V4 = '550e8400-e29b-41d4-a716-446655440000';
const UUID_V3 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('identifier primitives', () => {
  it('accepts canonical UUID v4 strings', () => {
    expect(uuidV4Schema.parse(UUID_V4)).toBe(UUID_V4);
    expect(isUuidV4(UUID_V4)).toBe(true);
  });

  it('rejects UUID v3 and non-UUID strings', () => {
    expect(() => uuidV4Schema.parse(UUID_V3)).toThrow();
    expect(() => uuidV4Schema.parse('not-a-uuid')).toThrow();
    expect(isUuidV4(UUID_V3)).toBe(false);
    expect(isUuidV4('not-a-uuid')).toBe(false);
  });

  it('treats branded ids as distinct types at compile time', () => {
    const tagA = brandedId('A');
    const tagB = brandedId('B');
    const a = tagA.parse(UUID_V4);
    expect(() => tagB.parse(a)).not.toThrow();
    // The runtime values are equal; the brand only exists in the type system.
    expect(a).toBe(UUID_V4);
  });

  it('exposes a ULID regex matching the canonical alphabet', () => {
    expect(ulidRegex.test('01H8XGJWBWBAQ7Z6K3S6Y8K9JE')).toBe(true);
    expect(ulidRegex.test('01H8XGJWBWBAQ7Z6K3S6Y8K9JEO')).toBe(false); // O is excluded
    expect(ulidRegex.test('01H8XGJWBWBAQ7Z6K3S6Y8K9JEL')).toBe(false); // L is excluded
    expect(ulidRegex.test('short')).toBe(false);
    expect(ulidRegex.test('01H8XGJWBWBAQ7Z6K3S6Y8K9JE44')).toBe(false); // too long
  });

  it('restricts locale to fr or en', () => {
    expect(localeSchema.parse('fr')).toBe('fr');
    expect(() => localeSchema.parse('de')).toThrow();
  });

  it('enforces respondent pseudonym rules', () => {
    expect(respondentPseudonymSchema.parse('auditor-pilot-001')).toBe('auditor-pilot-001');
    expect(() => respondentPseudonymSchema.parse('Has Spaces')).toThrow();
    expect(() => respondentPseudonymSchema.parse('a')).toThrow();
    expect(() => respondentPseudonymSchema.parse('a'.repeat(65))).toThrow();
  });

  it('rejects whitespace inside pagination cursors', () => {
    expect(paginationCursorSchema.parse('abcdef12-_-AZaz09')).toBe('abcdef12-_-AZaz09');
    expect(() => paginationCursorSchema.parse('has space')).toThrow();
  });
});
