# 0020 - Coverage gate in CI, scoped to contracts and domain

- Status: Accepted
- Date: 2026-10-17
- Deciders: maintainers
- Related: [0002](0002-monorepo-tooling.md), [0018](0018-devx-and-deploy.md), [0021](0021-manual-e2e-workflow.md)

## Context

M15 slice C added `pnpm coverage` and `scripts/coverage-threshold.mjs` (80% gate on
contracts, domain and ai). The gate was never run in CI, and it did not work:

- The `coverage` script asked for the `json` reporter, which writes
  `coverage-final.json`. The gate reads `coverage-summary.json`, so every package
  reported "no coverage summary" and the gate always failed.
- The `--coverage.include` globs were written relative to the repo root
  (`packages/contracts/src/**`), but vitest resolves them relative to each package.
  Nothing matched.

After fixing both, contracts and domain measure about 96% line coverage. services/ai
measures about 32%. Its `retentionWorker`, `synergyDetector`, `teamBadgeRollup` and
`worker` modules are covered only by the smoke CLIs against a live Postgres. Their
unit tests re-implement logic instead of importing the modules.

## Decision

1. The `coverage` script uses the `json-summary` reporter and includes `src/**/*.ts`
   in each package, so the gate reads the right file.
2. `ci.yml` runs `pnpm coverage` as a blocking step after `pnpm test`.
3. The gate enforces 80% on `packages/contracts` and `packages/domain`.
4. `services/ai` is report-only: the gate prints its number and does not fail on it.

## Alternatives

- **Gate services/ai at 80% now.** Would need fake-client tests for three DB-backed
  workers and the worker entry point. That is a multi-day test effort, and some of
  those files are being changed by other work in flight. CI would be red until it lands.
- **Lower the threshold for everything.** Weakens the signal for the packages that
  already meet 80%.
- **Non-blocking coverage step.** A gate nobody sees fail is not a gate.

## Consequences

- CI now enforces coverage on the two pure packages, which are the ones where unit
  tests are the right tool.
- services/ai coverage is visible in CI logs but not enforced. Promoting it to gated
  is a follow-up: write fake-client unit tests for the workers, then flip the flag in
  `TRACKED` in `scripts/coverage-threshold.mjs`.
- The gate's threshold and scope are a policy choice. The owner can change either
  without touching the reporter wiring.
