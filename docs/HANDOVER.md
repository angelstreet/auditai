# EvolAI — handover (2026-10-18)

Read this first, then [README](../README.md), [ROADMAP](ROADMAP.md), [PRD](PRD.md), the [ADR index](adr/) and
[AGENTS.md](../AGENTS.md) (rules for AI agents: public repo, no secrets, tests with every change).

## Where things stand (2026-10-20) and how to test both sides now

Live at `https://www.evolai.io` (Vercel project `evolai`, Neon Postgres in Frankfurt, pushes to `main` deploy to
production). All 25 migrations are applied to the live database. CI is green. It is an MVP for a first pilot: anything
enterprise-grade (DPA, MFA/SSO, recovery drill, approved AI route) is deliberately parked, see
[AUDIT_WORKFLOW.md](AUDIT_WORKFLOW.md).

**Two clients exist in the live database.** The real pilot client (name only in the database, never in this repo) and a
**safe sandbox called "Demo Client"** with a referent "Demo Referent" and the engagement "Pilote Demo Client", created for
testing. Test on the sandbox; leave the real client untouched until the pilot starts.

### Test both sides in about 15 minutes (sandbox)

Sign in at `https://www.evolai.io/login` with the owner address. The password is in a private file on codebox: run
`ssh codebox cat ~/.evolai-admin-login` (never paste it into chat or the repo). You land on the Portfolio.

**Side A, the auditor (you).**

1. Top bar, organisation chips or account menu: choose **Demo Client**.
2. Engagements, the audit, **Settings**: check headcount, dates, language, then **Launch** (links cannot be created before).
3. **Invitations**: create 5 links. Open one in a private window: that is what an employee sees. Answer the six questions
   and the three free-text ones (type a name, an email and a phone number in a free-text answer to see them masked),
   finish, then reopen the link.
4. Back in the admin: Teams for progress, Engagements then Analyses and Opportunities for what the analysis found
   (with only a few answers many things stay hidden below 5 people), then **Reports**: start the report, accept or write
   an improvement step, preview as the client, publish, download the PDF.
5. **Audit trail** and **Data** show what was done and let you test an export and an erase request.

**Side B, the referent (client contact).** There is no real referent login yet, so use "View as":

1. Account menu (your initials, top right) then **View as** then the Demo Client referent. A banner says read only.
2. You now see `/client`: home with progress and the "how it works" box, **Invitations** (links, the message to copy or share
   by email and WhatsApp, the single generic reminder), **Results**, **Report** (what is published and when).
3. Everything is read only in this mode; use "Back to my view" in the banner to return.
4. To test a real referent login: Teams then Referents, give the Demo Referent a throw-away address and press "Create
   sign-in link", open the link in a private window, choose a password. See RUNBOOK "Give a referent a real login".

What to write down: anything you hesitated on, any word you did not understand, anything you would not show a client.

### What was built since the 18 October handover (all merged, PR numbers on GitHub)

| PR           | What                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| #49          | Auditor set-up screens, organisation in the header, landing on the portfolio, plain wording, French fixes                                             |
| #50          | Referent self-service (share links, one generic reminder). The referent never sees who answered                                                       |
| #51, #53-#55 | Audit report: improvement-step catalogue, readiness score, report workflow, auditor and client screens, PDF, optional AI summary draft, AUDITOR_GUIDE |
| #52          | Referent login by link and password reset, complete privacy notice, audit-trail screen, safer erase and export                                        |
| #56          | PILOT_RUNBOOK (two-sided test script, set-up steps)                                                                                                   |
| #57          | Free-text answers are anonymised when saved (names, emails, phone numbers); backfill script                                                           |
| #58          | Bug fix: the survey is submitted when the person finishes, not when the done page loads                                                               |
| #59          | Questionnaire v1: six neutral choices, three optional free-text questions, one role question (`packages/contracts/src/questionnaires/pilot-v1.json`)  |
| #60          | Pilot polish: publish with a manual step, wide Reports layout, links and counts, copy and share on phones, referent "how it works"                    |

### Known limits and open items

- **Not verified by a human yet:** the whole journey end to end on a phone with a real person; a published report's PDF
  on paper; the French wording (needs one native read); the analysis quality on real answers (only made-up data so far).
- **Test-agent verdicts before the last fixes:** auditor 3/10 (no free text, no publish path), referent 6/10, employee 6/10.
  The fixes above target exactly those findings; a re-test is the real check (three testers on a fresh local copy, see
  docs/TEST_FEEDBACK_2026-10-19.md for the method).
- **Parked on purpose (MVP):** DPA and controller decision, real referent login for the real client, approved AI route,
  MFA/SSO, recovery drill, email-only accounts (a task brief exists, not started: docs/tasks/TASK-X-email-only-identity.md),
  personal tips per employee (decision pending: on-page tips, or an email-to-code mapping).
- **Housekeeping:** `/tmp/.env` on codebox still holds the database password and is readable by every user: delete it.
  Real client and referent names remain in the history of one old commit of this public repo (rewriting history was
  declined); the secret `BANNED_TERMS` blocks them from reappearing.

### Infrastructure notes (codebox and workers)

- Secrets live outside the repo: `~/.evolai.env` (database URLs and app secrets, mode 600) and `~/.evolai-admin-login`
  on codebox; Vercel sensitive environment variables for production. The repo is public: no secrets, no real names.
- On codebox the checkout `~/evolai` may be on someone else's branch: use `git -C ~/evolai fetch origin` and worktrees,
  never pull or commit there. The box has `earlyoom` (kills big processes below 15% free memory); cap vitest memory and
  run Playwright with one worker.
- Headless workers: `tmux new-session -d -s <name> "claude -p --dangerously-skip-permissions --model <m> \"$(cat brief.md)\"
| tee log"`. A headless run exits as soon as the worker stops calling tools: every brief says "never end the turn while
  something is pending; wait with blocking commands". Briefs are in `docs/tasks/` (TASK-A to TASK-Z2).

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
| S      | (see git log) | Referent self-service and the privacy fix: every link listed with copy/share and a ready-made fr/en message, one generic reminder, per-team bars with a minimum of 5 answers, no per-link status for the referent; closing date and contact in the auditor options; compact view-as banner on phones (ADR 0039) |

| U | (see git log) | Referent login by link and password reset, privacy notice per engagement with a request form, audit-trail screen, data-page safety, small-group guard (ADR 0040) |
| V | 51, 53, 54, (this PR) | The audit result the client receives: improvement-step catalogue (29 bilingual entries) matched to approved opportunities, deterministic readiness score with small-group and complementary suppression, report editor (summary with cited findings, accept/edit/reject steps, ranking, 30/60/90 plan), preview, publish/unpublish/versions, read-only Report tab for the referent, PDF, optional AI draft of the summary on the worker (ADRs 0041-0043, `docs/AUDITOR_GUIDE.md`) |
| Z1 | (this PR) | Pilot polish from three acceptance tests: publish with findings only and "Write my own" step without an opportunity, method note from real counts, few-respondents warning, wide reports pages, PDF control; one counting rule for invitations (`invitationNumbers`), https/http link scheme, full links with copy and native share and a selectable fallback; referent home "how it works" and reminder, Report tab explanation, logo to `/client`; one privacy sentence with the request form, one answer deadline, snackbars, answer button names (ADR 0047). No migration. |
| L | 38, 39, 41-45 | UI glow-up on MUI: theme with a lifted dark palette, header with identity menu, footer, welcome, login, respondent flow, admin tabs and danger flow, intake; style-guard rules 7-11; header and copy-length Playwright checks (ADR 0034, `docs/UI_RULES.md`, `docs/UI_GLOWUP_PLAN.md`) |

| Z2 | (see git log) | Questionnaire v1 for the pilot: ten questions in one versioned file (six neutral choices with "I don't know / It depends", three optional free-text questions, one coarse role question), free-text answering in the survey, analysis reads the person's own words and cites them, 13 gold respondents in `pnpm ai:eval`, neutral quiz copy, `pnpm questionnaire:apply`; no migration (ADR 0046) |

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
   Redaction terms per tenant live in the table `ai_redaction_terms` and are editable from Admin, **Names to hide**
   (`/admin/redaction`, ADR 0036).

## Open and deferred

**Pilot readiness first.** [PILOT_RUNBOOK.md](PILOT_RUNBOOK.md) records the verified state of the live site
(all 24 migrations applied, every screen healthy, invitation signing proven working, all four gates holding) and the
set-up steps the owner still has to do before a client can be invited: name the engagement, set the team headcount,
set the dates, fill the privacy notice, issue the referent a login link, then launch and invite.

Two production settings are open; neither blocks a pilot:

- `APP_BASE_URL` is not set in Vercel, so generated invitation links read `https://evolai.vercel.app/s/...`. They
  work (that host redirects to `www.evolai.io`) but the client sees a Vercel hostname in their inbox. Set it to
  `https://www.evolai.io` and redeploy.
- **Secret desync.** On 2026-10-18 `CRON_SECRET` and `SURVEY_SIGNING_SECRET` were rotated into the owner's local env
  file only; the same values never reached Vercel, so local and production differ. Links are unaffected (the server
  signs them and production's value is proven working), but the RUNBOOK command that triggers a cron by hand with
  `Authorization: Bearer $CRON_SECRET` taken from the local file is rejected. Push the local values to Vercel and
  redeploy, or read the bearer from Vercel for that one command.

- TASK-P (ADR 0035): migration **0019** is applied and `pnpm seed:client` has been run once (client tenant, one
  team, one engagement in _draft_, a referent with no password and no login link issued). Migrations **0021**,
  **0022**, **0023** and **0024** are all applied to the live database as of 2026-10-20.
  TASK-R (ADR 0037): `/intake` requires a staff session and uses the session's tenant; `/quiz` is a tenant-free demo.
  No migration. Route inventory: `apps/web/src/routeAccess.json`.
  TASK-T (ADR 0038): migration **0021** applied. The auditor now sets an audit up in the admin (new engagement, teams and
  sizes, launch, preview, first-run guide on the portfolio). The chosen organisation lives in the `evolai_org`
  cookie. Catalog words are guarded by `packages/i18n/src/jargon.test.ts`.
  TASK-S (ADR 0039): no migration. Set each engagement's closing date and contact on the auditor Invitations page
  (Options) before the referent sends links. Feedback items 4, 5, 7 to 13 and 15 of
  `docs/TEST_FEEDBACK_2026-10-19.md` remain.
  TASK-U (ADR 0040): migration **0022** applied. Referents get a real login from Admin, Teams, Referents
  (single-use link, no address stored); `/forgot-password` needs an email provider to deliver. **Fill the privacy
  notice per engagement** (engagement Settings) before the first real survey: it is still empty on the live client
  engagement and the public page hides whatever is not set. The
  auditor reads privacy requests on the Data page. Teams under 5 completed answers are hidden everywhere.
  TASK-V (ADRs 0041-0043): migrations **0023** and **0024** are applied. The auditor builds the deliverable in Admin,
  Reports; the referent reads the published version in the Report tab and downloads the PDF. The AI draft of the
  summary is an owner command and needs an approved real route (RUNBOOK). Sponsor accounts are not a separate role
  yet: send the PDF to the sponsor.
  TASK-W (ADR 0044): apply migration **0025** to Neon (forward only: audit verb `answers.anonymise`, target kind
  `tenant`). Free text is anonymised before it is saved (`anonymise()` in `@evolai/domain`, used by
  `POST /api/answer`). The survey has no free-text field yet, so today the route only receives a `comment` if one is
  added later. Run `pnpm anonymise:backfill` (dry run), then with `--apply`, on the live database once.

0. Invitations admin screen (TASK-N) is reachable and folded into the restyled admin shell.
   0b. TASK-Q (ADR 0036): migration **0020** applied. The per-tenant redaction list (the names the redactor scrubs
   before any model call) is editable from Admin, **Names to hide** (`/admin/redaction`); every add and remove is
   written to the audit trail.

1. Gate C: run the recovery drill once and record the result, SSO/MFA, pen test, SLA. Migrations 0017 and 0018 are
   applied, the first auditor exists, and `SURVEY_SIGNING_SECRET` is set in Vercel: a real invitation link was
   created and opened against production on 2026-10-20, so links no longer fail closed. The synthetic tenants and
   users still exist in the live database.
2. FR-03 (TASK-N, ADR 0033) is built and migration 0018 is applied. Still to set: `APP_BASE_URL` (see above) and,
   for email mode, `INVITE_EMAIL_KEY`, `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `EMAIL_FROM`. The Brevo adapter has
   only been tested against a stub.
3. Real-device test (low-end Android, iPhone, slow network) and a human screen-reader pass.
4. Human review of real-model theme quality. The redaction-terms admin screen shipped in TASK-Q.
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
