import { describe, expect, it } from 'vitest';
import {
  InvalidInviteToken,
  resolveSigningSecret,
  signInviteToken,
  verifyInviteToken,
} from './invitationToken';

const REFERENCE = 'inv-synthetic-pilot-001';

describe('invitationToken', () => {
  it('signs and verifies a token round-trip', () => {
    const token = signInviteToken(REFERENCE);
    const parsed = verifyInviteToken(token);
    expect(parsed.reference).toBe(REFERENCE);
    expect(parsed.signature).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('rejects a tampered reference', () => {
    const token = signInviteToken(REFERENCE);
    const tampered = token.replace(REFERENCE, REFERENCE.replace(/.$/, 'X'));
    expect(() => verifyInviteToken(tampered)).toThrow(InvalidInviteToken);
  });

  it('rejects a tampered signature', () => {
    const token = signInviteToken(REFERENCE);
    const tampered = token.replace(/.$/, (c) => (c === 'X' ? 'Y' : 'X'));
    expect(() => verifyInviteToken(tampered)).toThrow(InvalidInviteToken);
  });

  it('rejects a malformed token', () => {
    expect(() => verifyInviteToken('no-signature-here')).toThrow(InvalidInviteToken);
    // 'foo.bar' parses syntactically but the signature is too short to verify; signature check fails.
    expect(() => verifyInviteToken('only-one-half.sig')).toThrow(InvalidInviteToken);
  });
});

describe('resolveSigningSecret', () => {
  it('fails closed in production without a real secret', () => {
    expect(() => resolveSigningSecret({ NODE_ENV: 'production' })).toThrow(/SURVEY_SIGNING_SECRET/);
    expect(() =>
      resolveSigningSecret({ NODE_ENV: 'production', SURVEY_SIGNING_SECRET: 'short' }),
    ).toThrow(/SURVEY_SIGNING_SECRET/);
    expect(
      resolveSigningSecret({ NODE_ENV: 'production', SURVEY_SIGNING_SECRET: 'x'.repeat(32) }),
    ).toBe('x'.repeat(32));
  });

  it('keeps the dev default outside production and for the local runner', () => {
    expect(resolveSigningSecret({})).toMatch(/dev-only/);
    expect(resolveSigningSecret({ NODE_ENV: 'production', ALLOW_DEV_DB_PASSWORD: '1' })).toMatch(
      /dev-only/,
    );
  });
});
