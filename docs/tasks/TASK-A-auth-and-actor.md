# TASK-A — Authentication, tenant from session, real actor in audit trail (model: sonnet)

## Ground rules (read first)
- Repo: auditai (public: no secrets, IPs, hostnames, client names). Read AGENTS.md and the ADRs you touch. Use pnpm (`corepack pnpm`; put a `pnpm` shim on PATH if turbo cannot find it).
- Work in your OWN git worktree + branch (`git worktree add ~/auditai-<task> -b <task-branch> origin/main`). Never edit ~/auditai directly. Open a PR; do not merge other tasks work. Rebase on main before the PR.
- Gate before PR: `pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run leak-scan`, plus the relevant `pnpm mNN:smoke` after `pnpm local:up`. Report which gates you actually ran.
- Add a new ADR for each significant decision. Tests with every change.
- Owner autonomy rule from AGENTS.md applies. Ask only for credentials, money, real data, licence, irreversible actions.
- Context: a review of M15 (main @ 89ff7a8) found the items below. Other workers handle the other tasks in parallel (see docs/tasks/); keep to your scope and file set.
- End with `STATUS: done — ...` / `needs-owner: ...` / `blocked: ...`.

## Problem
- No auth on /admin/*: no middleware, server actions in apps/web/src/app/admin/data/actions.ts (and engagements/* actions) take tenantId from FormData and only regex-check it. Anyone reaching the app can export or erase any tenant.
- Actions hardcode SMOKE_AUDITOR_ID (99999999-...) as actor, so audit_log / deletion_events / export_requests never record who acted.
- /admin pages list every tenant via listTenantIds() under a service account.

## Do
1. Pick and document (ADR) a minimal real auth: signed, httpOnly, SameSite session cookie; auditor users in the users table; password or magic-link login behind a pluggable interface (real SSO/MFA stays Gate C; do not build it, but do not preclude it). No secrets in repo; session secret from env, fail closed when missing outside local dev.
2. Next middleware protecting /admin/**; unauthenticated -> /login. Respondent paths (/s, /intake, /quiz, /welcome, /privacy, /about) stay public.
3. Session carries userId + allowed tenant ids + role. Server actions and admin pages derive tenantId and actor from the session, never from FormData/query. Reject a tenant the user is not a member of. The tenant switcher lists only the user's tenants.
4. Replace SMOKE_AUDITOR_ID everywhere with the session user id. Keep smoke scripts working by seeding a test user (synthetic credentials in seed/fixture files only).
5. Tests: unit tests for session sign/verify and tenant-membership checks; Playwright/smoke proving (a) anonymous gets redirected from /admin/data, (b) user of tenant A cannot export or erase tenant B (forged tenantId in FormData is ignored or rejected), (c) audit rows carry the real user id.
## Out of scope
Erasure cascade, CSV escaping, db.ts SET LOCAL (TASK-B). i18n copy (TASK-C): any new login/admin strings go through the i18n helper if TASK-C has landed, else plain EN and note it.
