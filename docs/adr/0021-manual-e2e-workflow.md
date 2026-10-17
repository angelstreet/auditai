# 0021 - Local-stack e2e as a manual workflow, not a PR gate

- Status: Accepted
- Date: 2026-10-17
- Deciders: maintainers
- Related: [0006](0006-local-dev-runner.md), [0019](0019-public-routes-playwright.md), [0020](0020-coverage-gate-scope.md)

## Context

`pnpm test:e2e` chains the milestone smokes (`local:smoke` through `m15b:smoke`). Each
smoke needs `pnpm local:up` running: embedded Postgres plus a production Next.js build
on port 3101. The review asked for this to run in CI, if it runs in under 10 minutes,
and otherwise as a manual or nightly job.

Measured on the codebox host on 2026-10-17: `pnpm local:up` could not start. The
production build fails on `main`, because `packages/ui/src/index.ts` imports
`./mascots.jsx` while the source file is `mascots.tsx`. Webpack does not resolve that,
and `pnpm build` is not part of CI, so nothing has caught it. The smoke chain has
therefore not run end to end since the build broke. Its runtime is unknown.

## Decision

Add `.github/workflows/e2e.yml` with `workflow_dispatch` only. It installs, starts the
local stack in the background, waits on `pnpm local:status`, runs `pnpm test:e2e`,
stops the stack, and uploads the stack log. It is not a PR check and has no schedule.

## Alternatives

- **Add an e2e job to `ci.yml` now.** Would turn every PR red on the existing build
  break, and the runtime is still unmeasured.
- **Nightly schedule now.** Would produce a red run every day until the build is
  fixed. Add the schedule once the build is green and the runtime is known.

## Status

Blocked on the web build. The `mascots.jsx` import must be fixed in `packages/ui`
(application code, owned by a separate change) before the workflow can pass. Once it
passes, measure the runtime and decide whether to promote it to a PR job or a nightly
schedule. That decision gets its own ADR.

## Consequences

- The e2e path can be exercised on demand from the Actions tab.
- Nothing runs it automatically, so regressions in the smoke chain can land unseen
  until someone triggers it. This is accepted for now and is the main reason to fix
  the build and promote the job soon.
