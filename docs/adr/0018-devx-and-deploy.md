# 0018 - DevX (test:e2e + coverage gate) + Dockerfile + public contracts-map landing (M15 slice C)

- Status: Accepted
- Date: 2026-10-17
- Deciders: maintainers
- Related: [0001](0001-license-and-stack.md), [0006](0006-local-dev-runner.md), [0016](0016-fr09-retention-export-deletion.md), [0017](0017-board-integration-and-landing.md)

## Context

The previous slices shipped tests, lint, typecheck, format, leak-scan
as the CI gate, but:

- The owner still has to invoke each milestone smoke (`m10:smoke` \u2026
  `m15b:smoke`) individually.
- There is no coverage gate in CI; test counts grow but no enforcement
  on shrinking coverage.
- The dynamic web tier is not yet packaged for self-host pilots.
- The static contracts map is a useful public artifact but lives only in
  the repo as a markdown file.

This PR ships each of the four as small, minimal-scope additions.

## Decision

### 1. `pnpm test:e2e` alias

`package.json` gains:

```
"test:e2e": "pnpm local:smoke && pnpm m10:smoke && pnpm m11:smoke && pnpm m12:smoke && pnpm m13:smoke && pnpm m14:smoke && pnpm m15:smoke && pnpm m15b:smoke"
```

The owner can run a single command and exercise the entire
production path against `pnpm local:up`. The chain is fail-fast so a
broken smoke surfaces immediately with the failing milestone.

### 2. `pnpm coverage` + `coverage-threshold.mjs`

`scripts/coverage-threshold.mjs` reads the
`coverage/coverage-summary.json` for `packages/contracts`,
`packages/domain`, `services/ai` after `pnpm test` and exits non-zero
if any line coverage drops below the threshold (default 80%,
override via `--threshold=` or `COVERAGE_THRESHOLD`). The gate is
intentionally package-scoped (the only `tsc --noEmit` packages) so
the threshold is meaningful, not noise.

`pnpm coverage` is the on-demand invocation. CI is not yet enforced
to call it \u2014 the gate exists for the owner and for future PRs.

### 3. Dockerfile + docker-compose.yml

`Dockerfile` is a two-stage Node 20 image:

- **builder** \u2014 installs via pnpm, builds `@auditai/web`.
- **runtime** \u2014 copies the artefacts; `pnpm --filter @auditai/web start`
  on port 3000; a `HEALTHCHECK` that hits `/about`.

Postgres is **not bundled** in the API image. `docker-compose.yml`
brings up:

- `db` \u2014 Postgres 17 on host port 54329.
- `migrate` \u2014 runs `infra/db/scripts/migrate.mjs` once and exits.
- `web` \u2014 production server on host port 3000, depends on
  `migrate` + `db`.

The local one-command runner (ADR 0006) remains the developer path;
this compose file exists for self-host pilots that want a single
`docker compose up`.

### 4. Public contracts-map landing

`landing/m15-contracts/index.html` is a static HTML page that the
owner can ship to `space.minimax.io` (next to the M8 / M12 / M14
mockups). It mirrors the markdown content of
`packages/contracts/src/contracts-map.md` plus the mascot tier
legend. No emoji, no external image, no JS.

## Consequences

- The owner can run `pnpm test:e2e` once and exercise M9 \u2192 M15b.
- Coverage drops below 80% on a tracked package now surfaces as a
  failing command, not as a silent regression.
- Self-host pilots have a one-line Docker deployment story.
- The contracts map becomes a public artifact for partner / consultant
  conversations about the data model.

## Alternatives considered

- **Bundle Postgres in the Dockerfile.** Rejected: PRD \u00a717 calls for
  portable, single-tenant deployments; externalising Postgres makes
  the API stateless.
- **Promote the contracts map to a Next.js route.** Rejected for the
  pilot: a static HTML page is easier to host publicly and doesn't
  need the database. The dynamic surface is the markdown file in
  the repo.
- **Fail the CI when coverage drops.** Deferred: the gate is invoked
  on demand first; once it stabilises the next PR can add it to the
  CI workflow.
- **`pnpm test:e2e` as a vitest project.** Rejected: each smoke is a
  database-roundtripping Node script; running them sequentially from
  npm keeps the dependency surface minimal.

## What's NOT in this PR

- **Playwright coverage of the public URLs at 3 sizes \u00d7 3 browsers.**
  Deferred; the dependency footprint is non-trivial and would need
  its own slice.
- **CI integration of the coverage gate.** Deferred; the gate is a
  one-shot command today, ready to drop into the workflow when the
  owner says go.
- **Cron for `runRetentionWorker`.** Deferred to Phase 3.
