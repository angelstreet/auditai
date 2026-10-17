# TASK-C — French + English (i18n) across the web app (model: sonnet)

## Ground rules (read first)
- Repo: auditai (public: no secrets, IPs, hostnames, client names). Read AGENTS.md and the ADRs you touch. Use pnpm (`corepack pnpm`; put a `pnpm` shim on PATH if turbo cannot find it).
- Work in your OWN git worktree + branch (`git worktree add ~/auditai-<task> -b <task-branch> origin/main`). Never edit ~/auditai directly. Open a PR; do not merge other tasks work. Rebase on main before the PR.
- Gate before PR: `pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run leak-scan`, plus the relevant `pnpm mNN:smoke` after `pnpm local:up`. Report which gates you actually ran.
- Add a new ADR for each significant decision. Tests with every change.
- Owner autonomy rule from AGENTS.md applies. Ask only for credentials, money, real data, licence, irreversible actions.
- Context: a review of M15 (main @ 89ff7a8) found the items below. Other workers handle the other tasks in parallel (see docs/tasks/); keep to your scope and file set.
- End with `STATUS: done — ...` / `needs-owner: ...` / `blocked: ...`.

## Problem
PRD requires English and French at launch (docs/PRD.md product languages, NFR). packages/i18n is a placeholder (supportedLocales + isSupportedLocale only); no UI uses it: every page, form, error and email-like string is hardcoded English.

## Do
1. ADR: choose the mechanism (recommended: next-intl or a small in-house typed dictionary with server + client helpers; locale in the URL prefix or cookie, default fr or en per PRD, Accept-Language negotiation on first visit, language switcher). Keep messages in packages/i18n as typed catalogs (en.ts, fr.ts) with a test that fails when a key exists in one locale and not the other, and a test for ICU/plural/placeholder parity.
2. Extract all user-visible strings from apps/web/src (respondent flow /s /intake /quiz, /welcome, /privacy, /about, /board, /admin/*, error messages returned by server actions, metadata titles) and packages/ui. Respondent-facing surfaces first (priority), admin second.
3. Write professional French (tutoiement vs vouvoiement: use vouvoiement for client/employee-facing, document it in the ADR). Mascot/brand names and the 6-principle content stay consistent with docs/ (see docs/EvolAI_Branding_Guide.md if present). Dates, numbers, CSV headers labels (not column keys) localised via Intl.
4. Content that is data not UI (quiz items, scenario questions, synergy text): item metadata already has locale (PRD). Check whether FR variants exist; list the gaps in the ADR and add FR translations for the seeded demo items. Do not machine-translate silently: mark as draft-fr in metadata for owner review.
5. Static landing pages in landing/ (brand, m12, m14, m15): add an FR version or language toggle if cheap; otherwise list as follow-up.
6. Playwright: extend public-routes.spec to run each public surface in fr and en; assert no raw message keys render and the html lang attribute is correct; keep the 3-viewport matrix. Add an e2e smoke for switching language.
## Out of scope
Auth (TASK-A), erasure (TASK-B). If those land first, rebase and translate their new strings; otherwise leave their strings for a follow-up and say so.
