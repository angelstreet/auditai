/**
 * The organisation the auditor is working on (TASK-T, ADR 0038). It lives in a cookie, set by the
 * middleware whenever a page is opened with `?tenant=<id>`, so every admin link keeps it and it is
 * never silently reset. The value is only a *preference*: it is honoured only when the signed
 * session already grants that organisation (see `orderTenants`). Edge-safe: no next/headers here.
 */
export const ORG_COOKIE = 'evolai_org';
export const ORG_HEADER = 'x-evolai-org';
export const ORG_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Move the preferred organisation to the front when the session holds it. Never adds one. */
export const orderTenants = <T extends string>(ids: readonly T[], preferred?: string): T[] =>
  preferred && ids.includes(preferred as T)
    ? [preferred as T, ...ids.filter((id) => id !== preferred)]
    : [...ids];
