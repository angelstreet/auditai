import { describe, expect, it } from 'vitest';
import { resolveAppPassword, withTenant } from './db';
import type { TenantId } from '@evolai/contracts';

describe('db hardening', () => {
  it('production fails closed without a real app password', () => {
    expect(() => resolveAppPassword({ NODE_ENV: 'production' })).toThrow(/DATABASE_APP_PASSWORD/);
    expect(() =>
      resolveAppPassword({ NODE_ENV: 'production', DATABASE_APP_PASSWORD: 'auditai' }),
    ).toThrow(/DATABASE_APP_PASSWORD/);
    expect(
      resolveAppPassword({ NODE_ENV: 'production', DATABASE_APP_PASSWORD: 'x'.repeat(24) }),
    ).toBe('x'.repeat(24));
  });

  it('keeps the dev default outside production', () => {
    expect(resolveAppPassword({})).toBe('auditai');
    expect(resolveAppPassword({ NODE_ENV: 'test', DATABASE_APP_PASSWORD: 'p' })).toBe('p');
  });

  it('withTenant rejects a non-UUID tenant before touching the pool', async () => {
    await expect(
      withTenant("x'; DROP TABLE tenants; --" as TenantId, async () => 1),
    ).rejects.toThrow(/not a UUID/);
  });
  it('lets the local runner opt into the dev default explicitly', () => {
    expect(resolveAppPassword({ NODE_ENV: 'production', ALLOW_DEV_DB_PASSWORD: '1' })).toBe(
      'auditai',
    );
  });
});
