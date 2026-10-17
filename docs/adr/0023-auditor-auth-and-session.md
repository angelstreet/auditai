# ADR 0023: Auditor authentication, session and actor identity

Status: accepted (TASK-A)

## Context

`/admin/**` and `/board` had no authentication. Server actions took `tenantId` from `FormData`
and recorded a hard-coded smoke auditor (or a header / first-auditor fallback) as the actor, so
`audit_log`, `deletion_events` and `export_requests` never said who acted, and any visitor could
export or erase any tenant (PRD §15, §25.1). SSO and MFA are Gate C and out of scope here, but
must not be precluded.

## Decision

- **Session**: a signed, `httpOnly`, `SameSite=Lax` cookie (`aai_session`, `Secure` in
  production). Value is `base64url(JSON payload).base64url(HMAC-SHA256)`; payload carries user id,
  display name, tenant memberships (`{id, role}`) and `iat`/`exp` (8 h). Implemented with WebCrypto
  so the same code runs in Edge middleware and Node.
- **Secret**: `AUTH_SESSION_SECRET` (>= 16 chars) from the environment. Outside `development` /
  `test` a missing secret throws and the middleware treats every request as unauthenticated (fail
  closed). Nothing secret is committed; the local runner and Playwright pass synthetic values.
- **Pluggable provider**: `AuthProvider.authenticate(credentials) -> user | null`. The first
  provider is email + password (scrypt hash in `users.password_hash`, migration 0015; email looked
  up through the existing `email_hash`). Memberships are always read from the database after
  authentication, so an SSO / MFA provider only has to implement `authenticate`.
- **Gate**: `src/middleware.ts` guards `/admin/*` and `/board` (it lists every tenant's portfolio,
  so it is auditor-only). Unauthenticated requests redirect to `/login?next=...`. Respondent
  routes (`/s`, `/intake`, `/quiz`, `/welcome`, `/privacy`, `/about`) are outside the matcher.
- **Tenant and actor from the session**: pages use `sessionTenantIds()` (only the user's
  admin-capable tenants, which also feeds the tenant switcher). Server actions call
  `resolveActor(formTenantId)`: the actor is always the session user; the form's tenant id is a
  selector accepted only if the session grants it, otherwise "Not a member of this tenant".
  Admin-capable roles: `platform_owner`, `auditor`.
- The `x-audit-actor-id` header, `findAuditorForTenant` and `SMOKE_AUDITOR_ID` in server code are
  removed. Smoke scripts sign in through `/api/auth/login` as the seeded synthetic auditors
  (`apps/web/scripts/smoke-auth.mjs`).

## Alternatives considered

- Auth.js / NextAuth: heavier, and its adapter model would be reworked anyway for Gate C SSO.
- Opaque server-side session ids in a table: allows instant revocation, but needs a migration, a
  store and cleanup; the signed cookie is enough until revocation is a requirement.
- Putting a single `activeTenantId` in the session: simpler actions, but forces a re-login or an
  extra endpoint to switch tenants. The validated-selector approach keeps the URL-driven switcher.

## Consequences

- Memberships are snapshotted at sign-in; a revoked membership stays effective for up to 8 h.
  Mitigation path: shorten the TTL or re-check memberships in `resolveActor` (one query).
- `users.password_hash` is readable under the existing `users_select` policy; it is a salted
  scrypt hash, but Gate C should move credentials to a restricted table or an IdP.
- No login rate limiting or lockout yet (Gate C hardening).
- Login copy is plain English; move to the i18n helper once TASK-C lands.
- Seeded synthetic passwords (`synthetic-password-a/b`) are for local, smoke and Playwright only.

## Operations

- Set `AUTH_SESSION_SECRET` (random, >= 16 chars) in every deployment; `AUTH_COOKIE_SECURE=0` is only
  for plain-http local runs (the local runner and Playwright set it).
- Playwright needs an external `DATABASE_URL` (the web server starts before global setup) and honours
  `PW_PORT` so parallel checkouts on one host do not reuse each other's server.
- Redirects from the login routes use a relative `Location`; the middleware builds an absolute URL from
  the request `Host` (an unparseable `Location` there made the middleware throw and fail open in testing).
