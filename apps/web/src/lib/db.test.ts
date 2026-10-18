import { describe, expect, it } from 'vitest';
import { resolveAppPassword, resolveSsl, withTenant } from './db';
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

describe('resolveSsl', () => {
  it('uses no TLS for loopback databases', () => {
    expect(resolveSsl('postgres://u:p@127.0.0.1:5432/db').ssl).toBe(false);
    expect(resolveSsl('postgres://u:p@localhost/db').ssl).toBe(false);
    expect(resolveSsl('postgres://u:p@db.example.test/db?sslmode=disable').ssl).toBe(false);
  });

  it('verifies the certificate for remote hosts and drops the sslmode alias', () => {
    const r = resolveSsl('postgres://u:p@ep-x-pooler.example.test/db?sslmode=require&foo=1');
    expect(r.ssl).toEqual({ rejectUnauthorized: true });
    expect(r.connectionString).not.toContain('sslmode');
    expect(r.connectionString).toContain('foo=1');
    expect(resolveSsl('postgres://u:p@db.example.test/db').ssl).toEqual({
      rejectUnauthorized: true,
    });
  });
});
