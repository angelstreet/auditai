# EvolAI — handover (2026-10-18)

Read this first, then [README](../README.md), [ROADMAP](ROADMAP.md), [PRD](PRD.md), the [ADR index](adr/) and
[AGENTS.md](../AGENTS.md) (rules for AI agents: public repo, no secrets, tests with every change).

## What it is

An open-source platform for evidence-based AI-adoption audits and change enablement. A company team answers a
short mobile survey (one tap per question, French or English). Auditors review the answers, an AI-assisted
pipeline proposes themes and opportunities with citations, and the team sees its own progress and badges.
Repository: `angelstreet/evolai` (formerly `auditai`; old URLs redirect). Licence: Apache-2.0. Public repo:
never commit credentials, hostnames, client names or real survey data.

## Map of the repo

| Path                    | What is there                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`              | Next.js app: respondent flow (`/s/...`, quiz, done/return), welcome, auditor admin, login, `/board`                                                                 |
| `apps/mobile`           | Placeholder (Phase 3, optional)                                                                                                                                     |
| `packages/contracts`    | Zod schemas and types shared everywhere (tenant, opportunity, export, deletion ...)                                                                                 |
| `packages/domain`       | Scoring and domain rules (deterministic)                                                                                                                            |
| `packages/i18n`         | Typed FR/EN catalogs, quiz items, locale helpers; glossary in `docs/glossary-fr-en.md`                                                                              |
| `packages/ui`           | Design tokens, MUI theme (light and dark), icon registry, shared components (`PageTitle`, `StatTiles`, `StatusText`, `EmptyState`, `ConfirmDialog` ...), Inter font |
| `services/ai`           | Analysis pipeline, provider abstraction (`src/llm`), redaction, cost caps, eval, retention worker                                                                   |
| `infra/db`              | Forward-only SQL migrations (Postgres + row-level security per tenant)                                                                                              |
| `tests/db`, `tests/e2e` | Isolation, erasure and end-to-end tests                                                                                                                             |
| `landing`               | Static landing and mockup pages (use the same tokens and font)                                                                                                      |
| `scripts`               | `leak-scan`, `style-guard`, `adr-numbers`, coverage threshold                                                                                                       |

## Run, test, deploy

```bash
corepack pnpm install --frozen-lockfile
pnpm local:up            # embedded Postgres 17 + migrations + app (synthetic seed data)
pnpm test:e2e            # milestone smoke chain      pnpm ai:eval   # mock-provider evaluation
pnpm run ci              # lint, typecheck, test, leak-scan, style-guard
docker compose up --build   # one-host Postgres + migrate + web on :3000
```

Gates on every push (`.github/workflows/ci.yml`): format, lint, typecheck, unit tests, coverage (80% on
contracts/domain/ai), style guard (design tokens, one font, no external font URLs), ADR numbers, leak scan,
`ai:eval` on the mock provider, Playwright (chromium at 360/768/1280, French and English, axe accessibility
scan, keyboard-only run). A manual/nightly workflow `e2e.yml` runs the milestone smokes. If turbo cannot find
`pnpm`, put a `pnpm` shim on PATH (`exec corepack pnpm "$@"`).
Production: Vercel project `evolai` (evolai.io) on Neon Postgres in Frankfurt; a push to `main` deploys. Operations are in
[RUNBOOK.md](RUNBOOK.md) (migrations, auditor accounts, secret rotation, health, cron, recovery drill). Local and CI
runs seed the synthetic auditor passwords with `infra/db/scripts/seed-synthetic-auth.mjs`; deployed databases have none
(ADR 0032). `docker-compose.yml` is for one host and has no sign-in until an auditor is created. The contracts-map page
deploy script only works inside its original environment (ADR 0022).

## History of the follow-up work (all merged to main)

| Task   | PR            | Result                                                                                                                                                                                                                                                                                                          |
| ------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1-M15 | 1-23          | Original build by a MiniMax session: schema + RLS, survey, auditor review, opportunities, quiz and badges, synergies, retention/export/deletion, Docker, coverage gate (ADRs 0001-0019)                                                                                                                         |
| A      | 26 (+27, 28)  | Auditor login and session, tenant taken from the session, real actor in the audit trail (ADR 0023); CI and smoke repairs                                                                                                                                                                                        |
| B      | 25            | Real pseudonym erasure across tables, scheduled retention, CSV formula-injection fix, parameterised tenant setting, production password guard (ADR 0030)                                                                                                                                                        |
| C      | 29            | French and English across the app (ADR 0024)                                                                                                                                                                                                                                                                    |
| D      | 24            | Coverage gate, manual e2e workflow, docs hygiene                                                                                                                                                                                                                                                                |
| E      | 30, 31        | Respondent UX: 7 taps instead of 13, one language, team status on return; design tokens and style guard; `docs/UX_AUDIT.md` (ADR 0025)                                                                                                                                                                          |
| F      | 32            | Rename to EvolAI; internal DB identifiers `auditai_app` / `auditai` kept on purpose (ADR 0026)                                                                                                                                                                                                                  |
| G      | 33            | One self-hosted font (Inter), deterministic Playwright, e2e in CI, neutral summary wording (ADR 0027)                                                                                                                                                                                                           |
| H      | 34            | Model-backed synthesis behind an allowlisted provider abstraction: redaction, injection suite, cost caps, citation checks, eval (ADR 0029)                                                                                                                                                                      |
| I      | (6c7a69a)     | Accessibility gate (axe, keyboard), next-steps and contact block, French copy pass (ADR 0028)                                                                                                                                                                                                                   |
| J      | 35            | ROADMAP truthful, unique ADR numbers, CODEOWNERS, real auditor ids in smokes (ADR 0031)                                                                                                                                                                                                                         |
| K      | (this PR)     | Production readiness: no public credentials, auditor CLI, login lockout and headers, plain public wording, region and TLS, health, retention cron, runbook (ADR 0032)                                                                                                                                           |
| P      | (see git log) | "View as" for the platform owner (signed in the session cookie, read only, every request audited) and the team referent space `/client`; `pnpm seed:client` (ADR 0035)                                                                                                                                          |
| X      | (see git log) | Email-only identity (ADR 0044): no name asked, stored or shown for accounts; `users.email`, nullable `display_name` (migration 0025); `pnpm identity:strip-names`                                                                                                                                               |
| S      | (see git log) | Referent self-service and the privacy fix: every link listed with copy/share and a ready-made fr/en message, one generic reminder, per-team bars with a minimum of 5 answers, no per-link status for the referent; closing date and contact in the auditor options; compact view-as banner on phones (ADR 0039) |

| U | (see git log) | Referent login by link and password reset, privacy notice per engagement with a request form, audit-trail screen, data-page safety, small-group guard (ADR 0040) |
| V | 51, 53, 54, (this PR) | The audit result the client receives: improvement-step catalogue (29 bilingual entries) matched to approved opportunities, deterministic readiness score with small-group and complementary suppression, report editor (summary with cited findings, accept/edit/reject steps, ranking, 30/60/90 plan), preview, publish/unpublish/versions, read-only Report tab for the referent, PDF, optional AI draft of the summary on the worker (ADRs 0041-0043, `docs/AUDITOR_GUIDE.md`) |
| L | 38, 39, 41-45 | UI glow-up on MUI: theme with a lifted dark palette, header with identity menu, footer, welcome, login, respondent flow, admin tabs and danger flow, intake; style-guard rules 7-11; header and copy-length Playwright checks (ADR 0034, `docs/UI_RULES.md`, `docs/UI_GLOWUP_PLAN.md`) |

Task briefs are kept in `docs/tasks/` (TASK-A to TASK-K).

## Gates (PRD section 25.4)

- **A, survey pilot:** isolation, retention, audit logs, erasure: implemented and tested. Approved AI data route: open.
- **B, AI synthesis:** redaction, injection tests, source traceability, cost ceiling implemented and proven on the
  mock. One real run on a cheap model with synthetic data: 100% of kept claims grounded, 0.0041 USD (ADR 0029).
  That proves grounding, not theme quality. A person must read real themes.
- **C, enterprise hosting:** partly done. Done: hosting on Vercel and Neon, no public credentials in the database,
  real auditor accounts by CLI, login lockout, security headers, health check, retention cron, runbook (TASK-K).
  Open: the written recovery drill has not been run (RUNBOOK), SSO/OIDC and MFA, pen test, SLA.
- **D, cross-company benchmarks:** not started.

## Decisions made by the owner

- Commit to main and merge yourself when gates pass; do not wait for approval.
- Privacy line kept as is: "Your company sees team totals, not your answers." Three extra colours approved
  (`teal-ink #0f7a6e`, `border-strong #8796a5`, `danger #b42318`). One font everywhere (Inter, self-hosted).
- Wording polish and mascot names are deferred to the end (cosmetic). "Your managers" removed from the summary text.
- Dedicated API key `ANTHROPIC_EVOLAI_API_KEY` (never reuse another project's key).

## Turn on a real AI route (owner steps)

Full detail in ADR 0029 section "Owner steps". Short version:

1. Keep the key in a gitignored env file outside the repo as `ANTHROPIC_EVOLAI_API_KEY=...` (currently on codebox
   in `~/.evolai.env`, mode 600). On the Mac it sits in a `.env` of another project folder: move it. The copy in
   `/tmp/.env` on codebox is world-readable: delete it.
2. Copy `services/ai/config/ai.config.json` outside the repo; add the approved route (provider, model, region
   label, base URL), a timestamped price entry and spend caps.
3. Run with `EVOLAI_AI_CONFIG`, `EVOLAI_AI_PROVIDER`, `EVOLAI_AI_MODEL`, `EVOLAI_AI_REGION`.
4. Use real survey data only after a contract-approved route (EU-hosted or self-hosted if the client requires it).
   Redaction terms per tenant go in the table `ai_redaction_terms` (no admin screen yet).

## Open and deferred

- TASK-P (ADR 0035): apply migration **0019** to Neon (forward only, audit verbs only), then run `pnpm seed:client`
  once for the first client with the names given in the brief (RUNBOOK "First client"), then sign out and in.
  The referent has a `.invalid` placeholder and no password until the owner supplies a real address.
  TASK-R (ADR 0037): `/intake` requires a staff session and uses the session's tenant; `/quiz` is a tenant-free demo.
  No migration. Route inventory: `apps/web/src/routeAccess.json`.
  TASK-T (ADR 0038): apply migration **0021** to Neon before the deploy (forward only: `engagements.name`,
  `invitations.batch_id`, audit verbs). The auditor now sets an audit up in the admin (new engagement, teams and
  sizes, launch, preview, first-run guide on the portfolio). The chosen organisation lives in the `evolai_org`
  cookie. Catalog words are guarded by `packages/i18n/src/jargon.test.ts`.
  TASK-S (ADR 0039): no migration. Set each engagement's closing date and contact on the auditor Invitations page
  (Options) before the referent sends links. Feedback items 4, 5, 7 to 13 and 15 of
  `docs/TEST_FEEDBACK_2026-10-19.md` remain.
  TASK-U (ADR 0040): apply migration **0022** to Neon before the deploy (forward only: `auth_tokens`,
  `public_attempts`, `privacy_requests`, six audit verbs). Referents get a real login from Admin, Teams, Referents
  (single-use link, no address stored); `/forgot-password` needs an email provider to deliver. Fill the privacy
  notice per engagement (settings page) before the first real survey; the public page hides what is not set. The
  auditor reads privacy requests on the Data page. Teams under 5 completed answers are hidden everywhere.
  TASK-V (ADRs 0041-0043): apply migrations **0023** (`audit_reports`, `report_steps`, `audit_report_versions`,
  report audit verbs) and **0024** (re-asserts the audit verb list, so the order 0022/0023 were applied in does not
  matter) to Neon before the deploy that shows the Reports tab. The auditor builds the deliverable in Admin,
  Reports; the referent reads the published version in the Report tab and downloads the PDF. The AI draft of the
  summary is an owner command and needs an approved real route (RUNBOOK). Sponsor accounts are not a separate role
  yet: send the PDF to the sponsor.

0. Invitations admin screen (TASK-N) lives in new files under `apps/web/src/app/admin/invitations/`. It is reachable by URL; TASK-L should add a header/nav link and fold it into the restyled admin shell (no existing admin file was touched). Migration 0018 only; no new migration in this step.

1. Gate C: run the recovery drill once and record the result, SSO/MFA, pen test, SLA. One-time owner commands after
   TASK-K merges: apply migration 0017 to Neon, set `CRON_SECRET` and a real `SURVEY_SIGNING_SECRET` in Vercel,
   create the first auditor (RUNBOOK). Until `SURVEY_SIGNING_SECRET` is set, invitation links fail closed.
   The seeded synthetic tenants and users still exist in the live database.
2. FR-03 (TASK-N, ADR 0033) is built: apply migration 0018 to Neon before the deploy that reads it, set `APP_BASE_URL`
   (optional), and for email mode `INVITE_EMAIL_KEY`, `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `EMAIL_FROM`. The Brevo
   adapter has only been tested against a stub.
3. Real-device test (low-end Android, iPhone, slow network) and a human screen-reader pass.
4. Human review of real-model theme quality; admin screen for redaction terms.
5. Phase 2 and 3 items (FR-10 to FR-17) and Gate D.
6. Deferred cosmetics: mascot names, final French wording read by a native speaker.
7. Cleanups: remove the old-cookie fallback after 8 hours (session) / 1 year (language cookie); optionally rename
   the internal DB role with a forward migration; `m13-smoke` and `synergy-smoke` read `SMOKE_AUDITOR_ID` from the
   environment (a real seeded user, fine).

## Working with AI workers on codebox

- Checkout: `~/evolai` on codebox (`~/auditai` is a symlink for old sessions). On the Mac: `~/auditai`, rename it
  to `~/evolai` when no session is using it.
- Start a worker: `ssh codebox '~/.local/bin/cbsession -n <name> -d ~/evolai -p claude -m <haiku|sonnet|opus> -H ~/handovers/auditai/<TASK>.md'`.
  Workers use their own git worktree and branch, merge to main themselves when gates pass, and end with
  `STATUS: done | needs-owner | blocked`. Sessions show on the dashboard and, for Claude, in the Claude app.
- Model choice that worked: Haiku for config and docs, Sonnet for features and security-sensitive code,
  Opus for audits and design-heavy work (UX audit, AI pipeline).
- Do not edit the live checkout for feature work. Never `tmux kill-server`.
