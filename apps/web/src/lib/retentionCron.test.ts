import { describe, expect, it } from 'vitest';
import { isCronAuthorized } from './retentionCron';

const SECRET = 'x'.repeat(32);

describe('cron authorization', () => {
  it('accepts only the exact bearer secret', () => {
    expect(isCronAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isCronAuthorized(`Bearer ${SECRET}y`, SECRET)).toBe(false);
    expect(isCronAuthorized(SECRET, SECRET)).toBe(false);
    expect(isCronAuthorized(null, SECRET)).toBe(false);
  });

  it('fails closed without a real secret', () => {
    expect(isCronAuthorized('Bearer undefined', undefined)).toBe(false);
    expect(isCronAuthorized('Bearer short', 'short')).toBe(false);
    expect(isCronAuthorized('Bearer ', '')).toBe(false);
  });
});
