import { describe, expect, it } from 'vitest';
import { DomainError, parseTenantId, requireSameTenant } from './ids.js';

const TENANT = '550e8400-e29b-41d4-a716-446655440000';
const OTHER = '550e8400-e29b-41d4-a716-446655440099';

describe('DomainError', () => {
  it('carries a code on top of the standard message', () => {
    const err = new DomainError('test_code', 'message');
    expect(err.code).toBe('test_code');
    expect(err.message).toBe('message');
    expect(err.name).toBe('DomainError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('parseTenantId', () => {
  it('accepts a valid UUID v4', () => {
    expect(parseTenantId(TENANT)).toBe(TENANT);
  });

  it('wraps zod errors as a DomainError', () => {
    expect(() => parseTenantId('not-a-uuid')).toThrow(DomainError);
  });
});

describe('requireSameTenant', () => {
  it('returns void when ids match', () => {
    expect(() => requireSameTenant(TENANT as never, TENANT as never, 'engagement')).not.toThrow();
  });

  it('throws on a mismatch', () => {
    expect(() => requireSameTenant(OTHER as never, TENANT as never, 'engagement')).toThrow(
      /different tenant/,
    );
  });
});
