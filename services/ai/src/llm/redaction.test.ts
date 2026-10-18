import { describe, expect, it } from 'vitest';
import { Redactor } from './redaction.js';
import { TENANT_A, TENANT_B } from './testFixtures.js';

describe('redaction', () => {
  it('replaces synthetic emails, phones, IBANs, long ids and listed names', () => {
    const r = new Redactor(TENANT_A, ['Zorblat Quenneville', 'Mira']);
    const text =
      'Ask Zorblat Quenneville (zorblat.q@synthetic.invalid, +33 6 00 00 00 01) or mira about badge 123456789 and FR76 0000 0000 0000 0000 0000 000.';
    const out = r.redact(text);
    expect(out).not.toMatch(
      /Zorblat|Quenneville|synthetic\.invalid|00 00 00 01|123456789|FR76|mira/i,
    );
    expect(out).toContain('[NAME_1]');
    expect(out).toContain('[EMAIL_1]');
    expect(out).toContain('[PHONE_1]');
    expect(out).toContain('[ID_1]');
    expect(out).toContain('[IBAN_1]');
    expect(r.restore(out, TENANT_A)).toBe(text);
  });

  it('keeps placeholders stable for the same value', () => {
    const r = new Redactor(TENANT_A, ['Mira']);
    expect(r.redact('Mira and MIRA')).toBe('[NAME_1] and [NAME_1]');
    expect(r.redact('mail a@synthetic.invalid twice a@synthetic.invalid')).toBe(
      'mail [EMAIL_1] twice [EMAIL_1]',
    );
  });

  it('does not touch short numbers, hours or names inside other words', () => {
    const r = new Redactor(TENANT_A, ['Ana']);
    const text = 'About 3 hours a week, 2026 budget, Banana team.';
    expect(r.redact(text)).toBe(text);
    expect(r.replacedCount).toBe(0);
  });

  it('neutralises placeholder-shaped text typed by a respondent', () => {
    const r = new Redactor(TENANT_A, ['Mira']);
    const out = r.redact('Mira wrote [NAME_1] and [EMAIL_9]');
    expect(out).toBe('[NAME_1] wrote (placeholder removed) and (placeholder removed)');
  });

  it('refuses to restore for another tenant', () => {
    const r = new Redactor(TENANT_A, ['Mira']);
    const out = r.redact('Mira');
    expect(() => r.restore(out, TENANT_B)).toThrow(/another tenant/);
  });
});
