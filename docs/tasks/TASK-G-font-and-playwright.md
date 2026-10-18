# TASK-G — One font everywhere, working Playwright in CI, plain "team summary" wording (model: sonnet)

## Ground rules

- Public repo: no secrets, IPs, hostnames. Own worktree + branch. Owner rule: merge to main yourself when gates pass (`format:check`, `lint`, `typecheck`, `test`, `leak-scan`, `style-guard`), confirm main CI green with `gh run list`. ADR (extend 0025 or add a new one). End with `STATUS: ...`.
- Owner decisions: wording changes are not a priority now; mascot names and cosmetics are corrected at the end. Do not ask questions.

## 1. One font, everywhere

Owner wants the same font on every surface, coherent; the choice is yours. Decision: **Inter** (already the token), **self-hosted** (woff2 files in the repo or `next/font/local`; no Google Fonts or any external font request: privacy and speed), weights 400/500/600 only, `font-display: swap`, system sans as fallback.

- Check what actually renders today in the app (the token names Inter, verify it is really loaded and not silently falling back to the system font).
- Apply it to the web app, packages/ui, all landing pages including the older mockups (`landing/m12-*`, `landing/m14-*`, `landing/m15-*`, brand): remove DM Serif Display, Outfit, JetBrains Mono and the Google Fonts links. Mockups must use the shared tokens and type scale too.
- Monospace: one system mono stack token, used only for code-like values.
- Extend `scripts/style-guard.mjs` (and its test) to fail on any `font-family` outside the token and on any external font URL. Keep landing token copy byte-equal as before.
- Playwright check: assert the computed font-family on respondent, admin, login and landing pages is the same primary family, and a FR page with long words does not overflow at 360px.

## 2. Playwright must work and run in CI

Playwright specs (respondent UX, fr/en public routes, mobile survey) currently time out locally waiting for the web server on a fresh checkout (webServer/DATABASE_URL startup). Fix the root cause: `playwright.config` webServer must start the app against the embedded test database with the right env (`DATABASE_URL`, session secret for dev, locale) deterministically; `global-setup` must not depend on leftover local state. Run the whole suite green locally from a clean clone state, then add it to `.github/workflows/ci.yml` as a normal job on every push and PR (install browsers with cache, upload traces and screenshots on failure). Keep total CI time reasonable (shard or limit to chromium plus the 360 and 1280 projects if needed; say so in the ADR).

## 3. Wording: "your managers"

PRD says managers get aggregate results by default, never individual answers. Replace "EvolAI presents a team summary to your managers" (and its French) with audience-neutral wording: "a summary for the whole team, without names" (FR equivalent, plain, same length). Keep it in the message catalogs only. Update tests that assert the old string. Close that item in docs/UX_AUDIT.md (decision: neutral wording, per PRD aggregate-by-default).
Mascot names and French copy review: leave as is, mark both "deferred to the end, cosmetic" in docs/UX_AUDIT.md.
