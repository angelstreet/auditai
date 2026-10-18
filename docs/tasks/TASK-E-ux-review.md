# TASK-E — Final-user UX audit and design-consistency pass (model: opus)

## Ground rules

- Repo: auditai (public: no secrets, IPs, hostnames, client names). Read AGENTS.md, docs/PRD.md (respondent flow, section 6 and NFRs), docs/INDEX.md, docs/adr/ (ADR 0023 auth, 0024 i18n) and docs/EvolAI_Branding_Guide.md or landing/brand if present.
- Work in your own worktree and branch (`git worktree add ~/auditai-ux -b task-e-ux origin/main`). Never edit ~/auditai directly. Put a `pnpm` shim on PATH if turbo cannot find it (`corepack pnpm`).
- Owner rule: commit to main and merge yourself when gates pass (`format:check`, `lint`, `typecheck`, `test`, `leak-scan`, relevant smoke and Playwright). Rebase right before merging. Confirm main CI is green with `gh run list`. Commit by explicit path only.
- Add an ADR for the design-system decisions (tokens, type scale).
- End with `STATUS: done — ...` / `needs-owner: ...` / `blocked: ...`.

## Your role

Act as an employee in a company team who was invited to answer an AI-adoption survey. You are busy and reluctant: you will give this a few minutes at most, you do not know any technical term, you leave at the first confusing or long screen. Then act as the same person coming back later to see "how is my team doing and what happens next".
Run the real app (`pnpm local:up`, then the web app; drive it with Playwright headless at 360x800 phone first, then 768 and 1280) in BOTH French and English. Take screenshots to a scratch folder (not committed).

## Part 1 — Respondent walkthrough (priority)

Walk the whole respondent path: invitation link /s/..., privacy notice, intake, questions, quiz, result/badge, team view (/board as a team member sees it), and the return visit.
For every screen record: taps/clicks to finish it, words on screen, anything technical or jargon (pseudonym, tenant, engagement, synergy, opportunity, analysis, audit, schema, RLS, token ...), long sentences, unclear next step, missing progress indicator, dead ends, anything that asks for more than needed.
Targets:

- Fewest possible clicks: one question per screen, big touch targets, no scrolling to find the main button, skip where lawful, autosave, can resume.
- Total time to finish stated up front and honest. Progress visible at every step.
- Plain words, short sentences (about 12 words max), same terms everywhere, FR and EN equally natural (check the French reads like a person wrote it: vouvoiement, no calques).
- "My progress / my team's progress": one glance answer ("you are 60% done", "your team: 7 of 12 answered", what happens next). Only useful info; remove numbers or charts that do not help a non-expert decide or act.
- Privacy reassurance in one short line, with detail one tap away, not a wall of text.
- Errors and empty states in plain words with a next action. Works on a slow phone, keyboard and screen-reader basics (focus, labels, contrast, tap target 44px).

## Part 2 — Visual consistency audit (all surfaces: respondent, board, admin, login, landing/)

Inventory every colour, font family, font size, weight, spacing, radius, shadow and button style actually used (CSS, inline styles, ui package, landing HTML). Compare with the brand palette and type guidance. Report: off-palette colours, one-off font sizes, mixed heading scales, inconsistent buttons/inputs/cards, inconsistent mascot usage, light/dark or contrast problems, FR text overflowing layouts (French runs longer).
Then fix: define design tokens once (CSS variables or theme in packages/ui: colours, type scale of a few sizes, spacing, radius), replace the one-offs across apps/web and packages/ui, unify buttons, form fields, cards, headings, and make the landing pages use the same tokens. Add a guard so drift is caught: a small script/test (lint-style) that fails on hex colours or font-size values outside the tokens, wired into CI.

## Part 3 — Fix what you found

Implement the fixes for Parts 1 and 2 yourself, in small PRs, highest user impact first (respondent flow before admin). Update the Playwright public-routes and fr/en specs so they keep passing, and add assertions that matter (for example: respondent survey page has exactly one primary button, progress element present, no banned jargon words on respondent pages in fr and en: a short list kept in one test file).

## Deliverable

- docs/UX_AUDIT.md (committed to main): top 10 findings ranked by user impact with before/after, the click-count per respondent task before vs after, the token table, what you changed, what you deliberately left and why, and any owner decisions needed (wording, brand colour choices).
- Keep admin/consultant screens out of the jargon rule (they may be denser) but they must share the same tokens and look consistent.
