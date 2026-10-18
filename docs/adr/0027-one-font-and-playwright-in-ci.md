# 0027 - One self-hosted font, deterministic Playwright startup, Playwright in CI (TASK-G)

- Status: Accepted
- Date: 2026-10-18
- Deciders: maintainers
- Related: [0025](0025-design-tokens.md), [0019](0019-public-routes-playwright.md), PRD §15, §16, [UX audit](../UX_AUDIT.md)

## Context

The token `--font-sans` named Inter, but nothing loaded it: the app had no `@font-face`, so every
visitor silently got the system font. The landing home page fetched Inter from Google Fonts, and the
older landing pages (M12 onboarding, M14 quiz) loaded DM Serif Display, Outfit and JetBrains Mono from
Google Fonts as well, so four families were in play and a visitor's browser contacted a third party
(a privacy and speed cost).

Playwright specs timed out on a fresh checkout: Playwright starts `webServer` before `globalSetup`,
so the `DATABASE_URL` that global setup produced never reached the server, which also needs a build.
The suite was not in CI at all.

## Decision

1. **Inter, self-hosted, three weights.** `@font-face` for Inter 400/500/600 (latin and latin-ext
   subsets, woff2, `font-display: swap`, SIL OFL licence file alongside) lives in
   `packages/ui/src/tokens.css`; files in `packages/ui/src/fonts/`. `landing/brand/` carries
   byte-identical copies of the CSS and of `fonts/` (static pages, no build step). Fallback stack:
   system sans. Web app, landing home, M12/M14/M15 pages all use `var(--font-sans)`.
2. **One mono token**, `--font-mono` (system monospace stack), used only for code-like values.
3. **Style guard** fails on any `font-family` that is not `var(--font-sans)`, `var(--font-mono)` or
   `inherit`, on any external font URL, and if `landing/brand/fonts` drifts from the source. Its rules
   are unit-tested (`scripts/style-guard.test.mjs`, `pnpm test:scripts`). The two archived root mockups
   (`landing/m12-mockup.html`, `landing/m14-quiz-mockup.html`) were unreferenced duplicates of the
   tokenised M12/M14 pages and are deleted rather than kept exempt. Weights 700/800 on the landing home
   became 600.
4. **Deterministic Playwright startup.** `apps/web/e2e/serve.mjs` is the one `webServer` command: use
   `DATABASE_URL` if set (CI), else boot embedded PostgreSQL 17 on a free port; migrate and seed; write
   the state file specs read; `next build`; `next start`. It stops the database on SIGTERM. Global
   setup and teardown are removed. `PW_SKIP_BUILD=1` reuses an existing build locally.
5. **Browser checks.** `e2e/fonts.spec.ts` asserts the same computed primary family on respondent,
   login, admin and landing, that Inter 400/500/600 are actually loaded, that no request leaves the
   host, and that French pages have no horizontal overflow at 360 px.
6. **CI job `e2e`** on every push and PR: Postgres service container, chromium only (the three
   existing viewport projects 360, 768 and 1280 all run in it), browser binaries cached by Playwright
   version, HTML report, traces and screenshots uploaded on failure, 25 minute limit. No sharding yet;
   revisit if the job exceeds ~10 minutes.

## Alternatives considered

- `next/font/local`: couples the font to Next and leaves the static landing pages unserved.
- A variable Inter file: one request but about 3x the bytes for the three weights we use.
- Keeping Google Fonts: external request, rejected on privacy grounds.
- Keeping `globalSetup` and starting the server from it: works but hides the server lifecycle; the
  single launcher is easier to reason about and to run in CI.

## Consequences

- No third-party request for fonts anywhere; the font really renders.
- Font files (~150 KB for six subsets) are stored twice in the repo (source and landing copy), kept in
  sync by the style guard.
- The e2e job adds browser install (cached) and a production build to CI time.
