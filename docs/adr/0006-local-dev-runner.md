# 0006 - Local development runner (one-command up / down / reset / smoke)

- Status: Accepted
- Date: 2026-10-14
- Deciders: maintainers
- Related: [0001](0001-license-and-stack.md), [0003](0003-rls-and-tenant-isolation.md), [0004](0004-mobile-survey-and-admin.md), [0005](0005-admin-data.md)

## Context

M1–M5 of Phase 1 produce a Next.js app (`apps/web`) backed by a PostgreSQL schema
(`infra/db/migrations/0001..0004`) with row-level security and a synthetic seed
(`0003_seed_synthetic.sql`). Before M7, exercising the survey end-to-end required:

1. `pnpm install` to populate the workspace.
2. A running PostgreSQL 17 instance reachable on the standard port.
3. Manual `node infra/db/scripts/migrate.mjs` to apply migrations.
4. `pnpm --filter @auditai/web build` to produce a production build.
5. `pnpm --filter @auditai/web start` on a known port.
6. Exporting `DATABASE_URL` to a connection string that matches the running Postgres.
7. Mints or signs an invitation token, then walks the survey by hand.

That is seven steps and at least two mental models (Node-side + Postgres-side) before a
contributor can see anything. CI does not help a local contributor because it uses a service
container the contributor does not have on their machine. A `docker-compose.yml` was considered
and rejected in [0001](0001-license-and-stack.md) because the project must be self-hostable on a
single VM without Docker.

The deliverable for M7 is "a one-command local runner that boots the full stack and a smoke
script that walks the survey end-to-end against it." This ADR records what we built, what we
rejected, and what the operational trade-offs are.

## Decision

We add a Node-only runner under `apps/web/scripts/local-stack.mjs` plus a `pnpm local:*` script
set in the root `package.json`. The runner:

- Boots an **embedded PostgreSQL 17** (`embedded-postgres` on Linux x64) into a fresh data
  directory under `os.tmpdir()`, then creates the `auditai_local` database.
- Applies every migration in `infra/db/migrations/` via the existing `migrate.mjs` runner. The
  migration runner is the source of truth for the `BEGIN` / `COMMIT` boundary; the runner just
  spawns it.
- Skips the Next.js build when `apps/web/.next/` already exists. We deliberately do not own the
  build pipeline: the contributor runs `pnpm --filter @auditai/web build` (or the regular
  Turborepo pipeline) and the local runner only consumes the artifact. This keeps the runner
  cheap and avoids rare `EAGAIN` errors from `next build`'s jest-worker spawn.
- Discovers a free TCP port for Postgres (preferred `54340`) and for the Next.js server
  (preferred `3101`). If the preferred port is taken, the runner picks the next free one.
- Writes the resolved ports to `/tmp/auditai-local-stack.ports.json` so that `pnpm local:status`
  in a separate process can probe the right address without depending on the auto-discovered
  port being the default.
- Prints a `READY postgres=...; web=...; admin=...` line on stdout that downstream tooling can
  parse; the runner idles until killed with SIGINT.
- Exposes `up` / `down` / `reset` / `status` subcommands. The status command probes both sides
  via a raw TCP connection to Postgres and a `fetch /about` to the web process. We do NOT use
  `pg.Client` from inside the runner because a top-level `await import('pg')` plus a
  `pg.Client` constructor silently exits the Node 24 process before any `await` on the returned
  client can run; a TCP probe is both faster and portable across Node versions.
- Stays single-tenant on purpose. Each `pnpm local:up` instance owns one Postgres on one port;
  the runner is not a multi-tenant dev cluster.

A separate `apps/web/scripts/local-smoke.mjs` walks the survey end-to-end:

1. `GET /about` → confirm the product name + the synthetic sample-survey link.
2. `GET /s/<token>` → confirm the welcome page renders.
3. `POST /api/locale` → switch to French.
4. `POST /api/answer` for each of the six synthetic questions.
5. `GET /s/<token>/done` → confirm the thank-you page.
6. Query `submissions` directly via `pg` to assert the row count increased by exactly one.
7. `GET /admin/engagements` → confirm the admin page renders and reflects the new submission.

The smoke script is self-resetting: before running, it deletes any prior submission + answers for
the synthetic-pilot invitation so the count check is idempotent across runs. The count query
runs as the application role with `app.is_service_account = 'on'` because the count is a
cross-tenant assertion and the RLS policy is `app.tenant_id = current_tenant OR is_service_account`
(see [0003](0003-rls-and-tenant-isolation.md)).

A third file, `tests/db/src/global-setup.ts`, already exists and uses `embedded-postgres` against
`postgres://...@127.0.0.1:54329/auditai_test` (the same port CI's service container uses). The
global-setup short-circuits when `DATABASE_URL` is already set, so the local runner's
`DATABASE_URL` pre-empts it; the test suite picks `embedded-postgres` when no `DATABASE_URL` is
present, and the service container when CI exports one. This is the same pattern we adopted for
CI in [0003](0003-rls-and-tenant-isolation.md).

## Alternatives considered

- **`docker-compose.yml` for Postgres + `docker compose up`.** Rejected by [0001](0001-license-and-stack.md);
  the project must work on a single VM without Docker. We would also have to ship Docker images
  for every supported Linux distribution, which is its own maintenance burden.
- **A separate `local-pg` binary the contributor must install.** Rejected because every
  additional binary the contributor has to keep on their machine is a barrier. `embedded-postgres`
  is a Node module, so it ships with the workspace.
- **Reuse Postgres on port 5432.** Rejected because the contributor might already be running
  Postgres on 5432 for another project. The runner asks for `54340` first and only then
  auto-discovers a free port.
- **A `Makefile` instead of `pnpm local:*` scripts.** Rejected because the project standard
  (set in [0001](0001-license-and-stack.md) and [0002](0002-tooling-and-ci.md)) is pnpm; mixing
  Makefile and pnpm scripts would confuse contributors.
- **Bake the smoke into a single `next dev` run.** Rejected because `next dev` and `next start`
  behave differently (no SSG cache, different module resolution, faster HMR, no production build
  errors). The smoke must exercise the production build so it surfaces the same errors the
  deploy would.
- **Run the smoke as a Playwright spec.** Rejected for M7 because the existing Playwright
  e2e tests are not part of CI and have pre-existing fixture mismatches (see
  `apps/web/e2e/admin-engagements.spec.ts`); a Node-only smoke is independent of the Playwright
  configuration and runs in seconds rather than tens of seconds. A future milestone can fold the
  Playwright tests into the same `pnpm local:up` flow.

## Consequences

Positive:

- A contributor can run `pnpm install && pnpm --filter @auditai/web build && pnpm local:up &&
pnpm local:smoke` and see the full survey, admin page and Postgres state in under two minutes
  on a clean machine, with no other infrastructure.
- CI stays unchanged: it uses the `postgres:17` service container and `pnpm test`. The runner is
  for the contributor; CI is for the merge gate. The two paths share the same `migrate.mjs`,
  the same migrations, the same seed, and the same app code, so divergence is bounded.
- The runner writes to `os.tmpdir()`, so leaving a stack running across reboots does not corrupt
  the workspace or leave a database in a weird state.
- The `READY ...` line is parseable, so a future IDE / dashboard integration can wait on it the
  same way the smoke script does today.

Negative / known trade-offs:

- The runner only ships `linux-x64` builds of embedded-postgres for Node 20 / 22 / 24. macOS and
  Windows contributors will need either a real Postgres or to build `embedded-postgres` from
  source. This is documented in the README.
- Auto-discovered ports mean the smoke script cannot hardcode `http://127.0.0.1:3101`. The
  contract is `export LOCAL_WEB_URL=$(grep '^READY ' <log> | extract web=...)`. The runner
  already prints the line; a future shell helper can parse it.
- `next build` is the only step the runner does NOT own, by design. If a contributor changes
  `apps/web` and forgets to rebuild, `pnpm local:smoke` will exercise the stale build. The
  workaround is documented in the README ("run `pnpm --filter @auditai/web build` first").
- The runner is a one-tenant, one-process stack. A contributor who wants to test multi-tenant
  isolation has to spin up two stacks on two ports, which the runner does not automate. The
  cross-tenant deny test (`tests/db/isolation.test.ts`) already covers this case at the schema
  level.
- The `pg.Client` interaction with Node 24's top-level-await detection is a known sharp edge;
  the runner side-steps it by probing Postgres with a raw TCP socket. If we ever need a richer
  status (e.g. row counts), we will run a small `psql`-style helper instead of `pg.Client` from
  the runner.

## Operational notes

- The data directory is created under `os.tmpdir()` with a prefix of `auditai-pg-local-`. The
  runner does not delete it on shutdown because `embedded-postgres` cleans it up on `stop()`.
- The web log and the Postgres log are written to the runner's stderr, which the launcher
  script redirects to `/tmp/local-up.log`. The printed "Logs: /tmp/auditai-local-postgres.log,
  /tmp/auditai-local-web.log" message is currently a hint of where the user could redirect
  their own launcher; the runner itself does not write to those paths.
- The runner is intentionally not invoked from `pnpm install` or `pnpm dev`; it is a separate
  workflow. CI does not run it.
- Migration files are still the source of truth. The runner does not migrate "in code" — it
  always runs `infra/db/scripts/migrate.mjs`, which is the same path CI uses.
