import { describe, expect, it } from 'vitest';
import { ORG_UUID, orderTenants } from './orgShared';
import { PRODUCTION_BASE_URL, resolveBaseUrl } from './invitationTracking';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('orderTenants', () => {
  it('puts a granted preference first and keeps the others in order', () => {
    expect(orderTenants([A, B], B)).toEqual([B, A]);
    expect(orderTenants([A, B, C], C)).toEqual([C, A, B]);
  });
  it('never adds an organisation the session does not hold', () => {
    expect(orderTenants([A, B], C)).toEqual([A, B]);
    expect(orderTenants([A, B], undefined)).toEqual([A, B]);
    expect(orderTenants([], A)).toEqual([]);
  });
});

describe('ORG_UUID', () => {
  it('accepts ids and refuses anything else', () => {
    expect(ORG_UUID.test(A)).toBe(true);
    expect(ORG_UUID.test("x'; drop table tenants;--")).toBe(false);
    expect(ORG_UUID.test('')).toBe(false);
  });
});

describe('resolveBaseUrl and the site URL setting', () => {
  it('prefers APP_BASE_URL, then NEXT_PUBLIC_SITE_URL, then the host', () => {
    const both = {
      APP_BASE_URL: 'https://app.invalid/',
      NEXT_PUBLIC_SITE_URL: 'https://site.invalid',
    };
    expect(resolveBaseUrl(both, 'h.invalid', null)).toBe('https://app.invalid');
    expect(
      resolveBaseUrl({ NEXT_PUBLIC_SITE_URL: 'https://site.invalid/' }, 'h.invalid', 'http'),
    ).toBe('https://site.invalid');
    expect(resolveBaseUrl({}, 'h.invalid', 'http')).toBe('https://h.invalid');
    expect(resolveBaseUrl({}, 'localhost:3000', 'http')).toBe('http://localhost:3000');
  });
  it('never emits a *.vercel.app link, falls back to the production domain', () => {
    expect(resolveBaseUrl({}, 'evolai.vercel.app', 'https')).toBe(PRODUCTION_BASE_URL);
    expect(resolveBaseUrl({}, 'evolai-git-x-team.vercel.app', null)).toBe(PRODUCTION_BASE_URL);
    expect(resolveBaseUrl({ APP_BASE_URL: 'https://app.invalid' }, 'x.vercel.app', null)).toBe(
      'https://app.invalid',
    );
    expect(resolveBaseUrl({}, 'www.evolai.io', 'https')).toBe('https://www.evolai.io');
  });
  it('ignores a malformed site URL', () => {
    expect(resolveBaseUrl({ NEXT_PUBLIC_SITE_URL: 'javascript:alert(1)' }, 'h.invalid', null)).toBe(
      'https://h.invalid',
    );
  });
});
