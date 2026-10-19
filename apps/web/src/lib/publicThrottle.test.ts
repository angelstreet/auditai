import { describe, expect, it } from 'vitest';
import { PUBLIC_LIMITS, isOverLimit } from './publicThrottle';

describe('public form rate limit', () => {
  it('allows the stated number per address and blocks the next', () => {
    const l = PUBLIC_LIMITS.forgot_password;
    expect(isOverLimit('forgot_password', { email: l.perEmail, ip: 1 })).toBe(false);
    expect(isOverLimit('forgot_password', { email: l.perEmail + 1, ip: 1 })).toBe(true);
    expect(isOverLimit('forgot_password', { email: 1, ip: l.perIp + 1 })).toBe(true);
  });
  it('is stricter for a reset than a day-long window would suggest: one hour', () => {
    expect(PUBLIC_LIMITS.forgot_password.windowMinutes).toBe(60);
  });
});
