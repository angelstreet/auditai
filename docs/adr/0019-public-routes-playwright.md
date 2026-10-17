# 0019 - Public-routes Playwright cross-viewport suite + static deploy script (M15 slice D)

- Status: Accepted
- Date: 2026-10-17
- Deciders: maintainers
- Related: [0004](0004-mobile-web-survey-stack.md), [0006](0006-local-dev-runner.md), [0017](0017-board-integration-and-landing.md), [0018](0018-devx-and-deploy.md)

## Context

The M5 mobile-survey test (`e2e/mobile-survey.spec.ts`) and the M6 admin
test (`e2e/admin-engagements.spec.ts`) cover one route each at one
viewport. PRD §16 calls for explicit acceptance at 360 px, mobile +
desktop. The M15 slice-D inventory leaves three public surfaces
without any layout gate: `/welcome`, `/board`, `/admin/synergies`,
`/admin/teams`, `/admin/data` (each added in M12 / M13 / M14 / M15).
This ADR ships a small suite that walks every public surface at every
viewport, plus a one-shot script for the static contracts-map deploy.

## Decision

### 1. `apps/web/e2e/public-routes.spec.ts`

Six cheap assertions per surface:

- `GET /welcome|board|quiz|admin/teams|admin/synergies|admin/data`
  returns HTTP 200.
- The page renders at least one `<h1>`/`<h2>`/`<h3>` (catches a 4xx that
  slipped past the status assertion).
- `/` 30x-redirects to `/welcome` (PRD §5; M15b landing change).
- On `mobile-360` the page never exceeds the viewport width (no
  horizontal scroll) for every public surface.
- The hero heading is `inViewport()` on `/welcome`.

The deeper per-route smoke (data assertions) is covered by the Node
`m10..m15b:smoke` scripts; this spec is the layout gate.

### 2. `apps/web/playwright.config.ts` gains a `tablet-768` project

| Project         | Viewport   | Use                         |
| --------------- | ---------- | --------------------------- |
| `mobile-360`    | 360 x 800  | PRD §16 minimum mobile      |
| `tablet-768`    | 768 x 1024 | consultant / iPad landscape |
| `desktop-admin` | 1280 x 800 | PRD §16 admin workspace     |

Each surface is exercised at every viewport because the M5 spec only
covered one; the matrix gate keeps future regressions honest.

### 3. `scripts/deploy-contracts-map.sh`

One-shot deploy for `landing/m15-contracts/index.html` via the
Mavis `mavis-website_deploy` App. Owner-only `M15_DEPLOY_TOKEN`
keeps credentials out of the repo. Failure paths:

- missing page → exit 2
- App missing → exit 3
- missing token → exit 4
- deploy failure → propagates from the App

The script copies the page to a unique staging dir so repeated runs
do not collide, invokes the App, then tears the staging dir down.

### 4. CI integration

Playwright is **opt-in in CI** (existing `ci.yml` does not change).
The owner runs `pnpm test:e2e -- --spec=e2e/public-routes.spec.ts`
locally to validate a milestone. The Node smoke chain
(`pnpm test:e2e`) covers the data layer; Playwright covers the
layout gate. A future PR can promote Playwright into the CI workflow
once the owner is confident the suite is stable.

## Consequences

- Three viewports × six routes × one assertion-per-viewport locks in
  the layout gate at minimal runtime cost.
- The deploy script is the single entry point for the contracts-map
  page; deploying the M8 / M12 / M14 mockups stays as-is (different
  tooling, different content).
- The Playwright suite is not yet run in CI; we land it now so the
  shape is reviewable, and let the owner decide when to wire it.

## Alternatives considered

- **Add webkit + firefox projects.** Rejected: the existing CI uses
  Chromium only; adding browser engine variety is a separate slice
  with non-trivial install / maintenance cost on the runner.
- **Run Playwright on every CI push.** Rejected: tests boot the
  next-start server + Postgres, which the suite already does for the
  unit task; doubling that cost for a layout gate is over-spending.
- **Wire a `vercel/ci` style deployment script.** Deferred: the
  static page is owner-published, not auto-deployed; the script
  matches the workflow.
