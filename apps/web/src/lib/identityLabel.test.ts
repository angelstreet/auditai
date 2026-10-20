import { describe, expect, it } from 'vitest';
import { emailLabel, initialsOf, userLabel } from './identityLabel';

describe('identity labels (email only, ADR 0044)', () => {
  it('uses the local part of the address', () => {
    expect(emailLabel('Ana.Demo@example.test')).toBe('Ana.Demo');
    expect(userLabel('referent-1@synthetic.invalid')).toBe('referent-1');
  });

  it('truncates a long local part', () => {
    const label = emailLabel(`${'a'.repeat(60)}@example.test`);
    expect(label).toHaveLength(24);
    expect(label.endsWith('…')).toBe(true);
  });

  it('copes with null, undefined and empty values', () => {
    expect(emailLabel(null)).toBe('');
    expect(emailLabel(undefined)).toBe('');
    expect(emailLabel('')).toBe('');
    expect(userLabel(null, 'Referent')).toBe('Referent');
    expect(userLabel('   ')).toBe('—');
    expect(initialsOf('')).toBe('?');
  });

  it('takes initials from the local part', () => {
    expect(initialsOf('ana.demo@example.test')).toBe('AD');
    expect(initialsOf('referent-1@synthetic.invalid')).toBe('R1');
    expect(initialsOf('auditor@example.test')).toBe('AU');
  });
});
