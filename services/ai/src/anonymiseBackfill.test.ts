import { describe, expect, it } from 'vitest';
import { anonymiseValueJson } from './anonymiseBackfill.js';

describe('anonymiseValueJson', () => {
  it('anonymises the rationale of a scenario choice and keeps the choice', () => {
    expect(
      anonymiseValueJson(
        { kind: 'scenario_choice', choice: 'a', rationale: 'ask jane@synthetic.invalid' },
        'en',
        [],
      ),
    ).toEqual({ kind: 'scenario_choice', choice: 'a', rationale: 'ask [email]' });
  });
  it('anonymises short text with the tenant terms', () => {
    expect(
      anonymiseValueJson({ kind: 'short_text', text: 'chez Demo Client' }, 'fr', ['Demo Client']),
    ).toEqual({ kind: 'short_text', text: 'chez [organisation]' });
  });
  it('returns null when there is no free text', () => {
    expect(
      anonymiseValueJson({ kind: 'scenario_choice', choice: 'a', rationale: null }, 'en', []),
    ).toBeNull();
    expect(anonymiseValueJson({ kind: 'scale_5', value: 3 }, 'en', [])).toBeNull();
    expect(anonymiseValueJson(null, 'en', [])).toBeNull();
  });
  it('is idempotent', () => {
    const once = anonymiseValueJson({ kind: 'short_text', text: 'call 06 12 34 56 78' }, 'fr', []);
    expect(anonymiseValueJson(once, 'fr', [])).toEqual(once);
  });
});
