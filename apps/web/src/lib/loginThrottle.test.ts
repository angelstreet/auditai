import { describe, expect, it } from 'vitest';
import { THROTTLE, clientAddress, isLockedOut } from './loginThrottle';

const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

describe('login throttle policy', () => {
  it('allows below the limits and locks at them', () => {
    expect(isLockedOut({ email: 0, ip: 0 })).toBe(false);
    expect(isLockedOut({ email: THROTTLE.maxFailuresPerEmail - 1, ip: 0 })).toBe(false);
    expect(isLockedOut({ email: THROTTLE.maxFailuresPerEmail, ip: 0 })).toBe(true);
    expect(isLockedOut({ email: 0, ip: THROTTLE.maxFailuresPerIp })).toBe(true);
  });

  it('reads the first forwarded address, preferring the platform header', () => {
    expect(clientAddress(headers({ 'x-forwarded-for': '198.51.100.7, 10.0.0.1' }))).toBe(
      '198.51.100.7',
    );
    expect(
      clientAddress(
        headers({ 'x-vercel-forwarded-for': '203.0.113.9', 'x-forwarded-for': '198.51.100.7' }),
      ),
    ).toBe('203.0.113.9');
    expect(clientAddress(headers({}))).toBe('unknown');
  });
});
