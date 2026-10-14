# ADR 0003 \u2014 PostgreSQL migrations, RLS, isolation tests

Status: proposed (2026-10-14). Created as part of M4 ([roadmap](../ROADMAP.md)).

## Context

PRD \u00a714, \u00a715, \u00a716, \u00a725.1 and \u00a733 require:

- Multi-tenant data model with `tenant_id` on every client-owned row.
- PostgreSQL row-level security as the boundary (deny by default).
- An automated cross-tenant deny test that fails when a tenant query returns another tenant's rows.
- No reliance on the application layer alone for isolation.

M3 produced the schemas; M4 commits the migrations and the test.

## Decisions

### Migration layout

- Plain numbered SQL files under `infra/db/migrations/0001_*.sql` etc.
- A small Node runner `infra/db/scripts/migrate.mjs` applies them in order using `pg`, with an
  `app_schema_migrations` bookkeeping table for idempotency. Each migration runs in its own
  transaction.
- No third-party migration framework (no Flyway, no Liquibase, no Sqitch). The repo only has a few
  migrations today; a hand-rolled runner is easier to audit and to run inside Docker / embedded
  Postgres for tests.

### RLS model

- Every tenant-scoped table runs `ALTER TABLE \u2026 ENABLE ROW LEVEL SECURITY` and
  `ALTER TABLE \u2026 FORCE ROW LEVEL SECURITY`.
- The application sets `SET LOCAL app.tenant_id = '\u2026'` at the start of every transaction.
- Policies compare `tenant_id = app_current_tenant_id()`. A second setting
  `SET LOCAL app.is_service_account = 'on'` bypasses the filter so admin / migration jobs can read
  or repair any tenant's data; INSERT still enforces `WITH CHECK` so the application cannot insert
  rows into a different tenant by accident.
- Two helper SQL functions, `app_current_tenant_id()` and `app_is_service_account()`, are
  `STABLE` and read `current_setting(..., true)` so an unset variable yields `NULL` and the policy
  fails closed.
- The `tenants` table itself is RLS-gated with a self-only policy and an explicit service-account
  bypass for INSERT and DELETE (used by onboarding flows).
- `users` is global; reads are unrestricted but writes require `app.is_service_account` because the
  application creates users via a service role, never as a respondent.

### Bootstrap user vs. application role

- `initdb -U auditai` creates a _superuser_. Superusers bypass RLS even with `FORCE`.
- Migration 0004 creates `auditai_app NOSUPERUSER NOBYPASSRLS` and grants table-level CRUD on
  `public`. The migration runner keeps using the bootstrap user (it needs DDL); the API and the
  isolation test connect (or `SET ROLE`) as `auditai_app`. Defence in depth \u2014 even if a service
  forgets to set `app.tenant_id`, the policy yields zero rows, not every tenant's data.

### Cross-tenant deny test (`tests/db/isolation.test.ts`)

- Vitest + `pg` + an embedded Postgres (`embedded-postgres`) so the test runs locally without
  Docker. The same test runs against the CI `postgres:17` service container because the global
  setup only spins up the embedded cluster when `DATABASE_URL` is unset.
- The test exercises:
  - SELECT in tenant A only returns rows whose `id` starts with `a\u2026`, and likewise for B.
  - UPDATE/DELETE on rows belonging to another tenant reports zero rows affected.
  - INSERT with a `tenant_id` different from `app.tenant_id` is rejected by the WITH CHECK policy.
  - SELECT with no `app.tenant_id` set returns zero rows (fail closed).
  - The join table `engagement_teams` is filtered by `tenant_id` too.
- All 20 scenarios pass; the test is intentionally verbose because isolation regressions are
  silent and catastrophic.

### CI changes

- `.github/workflows/ci.yml` adds a `postgres:17` service container and exports `DATABASE_URL`
  pointing at it. The `tests-db` package discovers the env var and skips embedded bootstrap.

## Alternatives

- **Prisma / Drizzle migrations**: faster authoring but their generated SQL is opaque and the
  schemas would have to mirror the Zod contracts in M3. Rejected for Phase 1; we can revisit
  once migrations outgrow a single directory.
- **Per-tenant databases (PRD \u00a724.1)**: cleaner blast radius but doubles infra cost and complicates
  cross-tenant admin views. Acceptable for enterprise self-hosting; not for the consultant-managed
  pilot.
- **Application-layer authorisation only**: rejected. PRD \u00a725.1 #1 explicitly says RLS is the boundary
  and the application guard is defence in depth.

## Consequences

- Every new client-owned entity needs four lines in `0001_init.sql`, a `tenant_id` column, and a
  `FORCE ROW LEVEL SECURITY` toggle. Templates and snippets live in this ADR.
- Service-account code paths must be flagged in code review. A future improvement: add a
  per-tenant audit log row for every operation performed under `app.is_service_account`.
- The migration runner does not down-migrate. Rollbacks are by writing a forward migration.
