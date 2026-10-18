# TASK-I — Accessibility test, trust and next-step clarity, French copy review (model: sonnet)

## Ground rules

- Public repo: no secrets, keys, IPs, hostnames, client names, real data. Read AGENTS.md, docs/PRD.md and the ADRs you touch. Use `corepack pnpm`; put a `pnpm` shim on PATH if turbo cannot find it.
- Own git worktree + branch off origin/main. Owner rule: when gates pass (`format:check`, `lint`, `typecheck`, `test`, `leak-scan`, `style-guard`, relevant smokes and Playwright) rebase, merge to main yourself, confirm main CI green with `gh run list`. Commit by explicit path. Add an ADR (use the next free number at merge time; other workers add ADRs in parallel).
- Never commit credentials. Real model access comes only from environment variables set by the owner.
- Owner priorities: simple, minimal clicks, plain short words for respondents, FR and EN equal, one font and the design tokens (ADR 0025, 0027). Wording polish and mascot names are deferred; do not ask questions.
- End with `STATUS: done — ...` / `needs-owner: ...` / `blocked: ...`.

## 1. Accessibility (real tooling, respondent flow first, then admin)

- Add axe-core to the Playwright suite (`@axe-core/playwright`): scan every respondent page (welcome, survey start, each question type, done, return view, quiz, error and expired-link pages), login, and the main admin pages, in fr and en, at 360 and 1280. Zero serious or critical violations is the gate in CI; fix what it finds.
- Keyboard-only test: complete the whole respondent survey with Tab, Enter, Space and arrows (no mouse); visible focus ring on every control using a token; logical tab order; skip link; no focus traps; focus moves to the new heading on each question. Add as a Playwright spec.
- Screen reader basics by inspection and ARIA snapshot assertions: one h1 per page, landmarks, labelled progress (role=progressbar with value text), error messages announced (aria-live), buttons vs links correct, language attribute, images and mascots with alt text or aria-hidden, no information by colour alone. Respect prefers-reduced-motion and 200 percent zoom without horizontal scroll at 360px.
- Re-check contrast of every token pair in light theme with a test (extend tokens.test.ts).

## 2. Trust and "what happens next" (respondent)

- One short plain block on the done page and the return view: what happens next in two or three steps, when, and who to contact. The contact is a configurable per-engagement value (field in the engagement settings; fall back to a generic "ask the person who invited you"); never hard-code an address.
- Keep the one-line privacy promise exactly as is. Detail stays one tap away. Add a visible "delete my answers" path explanation in plain words only if the erasure flow supports a respondent-initiated request; if not, state honestly how to ask for deletion (via the contact). Do not promise what the app does not do.
- Add the same reassurance wording consistently in fr and en in the catalogs.

## 3. French quality pass

Read every French string in packages/i18n (survey, quiz items, done, return, errors, login, admin, mascot descriptions) as a native French copy editor: natural phrasing, vouvoiement, no anglicisms or calques, consistent terms (one word per concept, listed in a small glossary file docs/glossary-fr-en.md), correct typography (espaces insécables before : ; ? !, guillemets, apostrophe typographique), sentences about 12 words max for respondents. Fix in place, keep keys. Mascot names stay as they are (deferred to the end); only fix their descriptions. Mark the quiz and scenario items you changed in the changelog section of docs/UX_AUDIT.md. Add a test that FR and EN catalogs have the same keys and no placeholder mismatches (extend the existing one if present).
