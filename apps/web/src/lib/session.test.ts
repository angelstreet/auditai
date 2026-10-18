import { describe, expect, it } from 'vitest';
import {
  MissingSessionSecret,
  newSessionPayload,
  resolveSecret,
  signSession,
  verifySession,
} from './session';

const SECRET = 'unit-test-secret-0123456789';
const payload = newSessionPayload(
  { id: 'u1', name: 'U One' },
  [{ id: 't1', role: 'auditor' }],
  1000,
);

describe('session sign/verify', () => {
  it('round-trips a payload', async () => {
    const token = await signSession(payload, SECRET);
    expect(await verifySession(token, SECRET, 1001)).toEqual(payload);
  });
  it('carries the normalised sign-in email for the account menu', async () => {
    const withEmail = newSessionPayload(
      { id: 'u1', name: 'U One', email: ' Someone@synthetic.invalid ' },
      [],
      1000,
    );
    expect(withEmail.email).toBe('someone@synthetic.invalid');
    const token = await signSession(withEmail, SECRET);
    expect((await verifySession(token, SECRET, 1001))?.email).toBe('someone@synthetic.invalid');
  });
  it('rejects a tampered payload', async () => {
    const token = await signSession(payload, SECRET);
    const [, sig] = token.split('.');
    const forged = btoa(
      JSON.stringify({ ...payload, tenants: [{ id: 't2', role: 'auditor' }] }),
    ).replace(/=+$/, '');
    expect(await verifySession(`${forged}.${sig}`, SECRET, 1001)).toBeNull();
  });
  it('rejects a wrong secret, expiry, and garbage', async () => {
    const token = await signSession(payload, SECRET);
    expect(await verifySession(token, 'another-secret-0123456789', 1001)).toBeNull();
    expect(await verifySession(token, SECRET, payload.exp + 1)).toBeNull();
    expect(await verifySession('nope', SECRET)).toBeNull();
    expect(await verifySession(undefined, SECRET)).toBeNull();
  });
  it('fails closed without a secret outside development', () => {
    expect(() => resolveSecret({ NODE_ENV: 'production' })).toThrow(MissingSessionSecret);
    expect(() => resolveSecret({ NODE_ENV: 'production', AUTH_SESSION_SECRET: 'short' })).toThrow(
      MissingSessionSecret,
    );
    expect(resolveSecret({ NODE_ENV: 'development' })).toBeTruthy();
    expect(resolveSecret({ NODE_ENV: 'production', AUTH_SESSION_SECRET: SECRET })).toBe(SECRET);
  });
});
