import { describe, expect, it } from 'vitest';
import { legacyTarget } from './legacyRoute';

describe('legacyTarget', () => {
  it('keeps a well-formed organisation and drops anything else', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(legacyTarget('/admin/engagements', id)).toBe(`/admin/engagements?tenant=${id}`);
    expect(legacyTarget('/admin/engagements', 'x"><script>')).toBe('/admin/engagements');
    expect(legacyTarget('/admin/engagements')).toBe('/admin/engagements');
  });
});
