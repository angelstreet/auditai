import { describe, expect, it } from 'vitest';
import { passwordProblem } from './passwordPolicy';

describe('password policy', () => {
  it('needs 12 characters, nothing else', () => {
    expect(passwordProblem('12345678901')).toBe('too_short');
    expect(passwordProblem('123456789012')).toBeNull();
    expect(passwordProblem('a '.repeat(10))).toBeNull();
    expect(passwordProblem('x'.repeat(257))).toBe('too_long');
  });
  it('checks the typed copy', () => {
    expect(passwordProblem('123456789012', '123456789013')).toBe('mismatch');
    expect(passwordProblem('123456789012', '123456789012')).toBeNull();
  });
});
