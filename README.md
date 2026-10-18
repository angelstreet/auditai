# EvolAI

> Discover how work really happens. Build AI confidence. Turn friction into measurable improvements.

An **open-source platform for evidence-based AI adoption audits and AI change enablement**. Employees answer short,
adaptive, mobile questionnaires; auditors review AI-assisted, source-linked findings and map workflows; company leaders
get validated opportunities, an adoption roadmap, governance artefacts and measured outcomes.

It is **not** an employee performance-ranking tool: it assesses work practices, readiness and improvement opportunities,
with privacy thresholds, human review of every AI output, and strict tenant isolation.

**Status:** milestones M1–M15 and the review follow-up tasks A–I are merged to `main` with green CI.
The milestones cover the auditor review, opportunity register, sponsor onboarding and portfolio board,
cross-team synergies, the gamified literacy quiz with mascot badges, and FR-09 retention, deletion and export.
The follow-ups add real auditor sign-in with tenant isolation, real pseudonym erasure, French and English in
the app, the accessibility gate, and the first model-backed AI synthesis behind an allowlisted provider (the
default route is still the rule-based one). Open work is listed in [docs/ROADMAP.md](docs/ROADMAP.md#what-is-left):
Gate B real-model run and EU or self-hosted route, Gate C SSO/MFA and production hosting, invitations and
reminders (FR-03), real-device and screen-reader tests, and the Phase 3 items. Real survey data needs the Gate B
and Gate C items closed first. The product requirements are in [docs/PRD.md](docs/PRD.md); the phased
delivery plan is in [docs/ROADMAP.md](docs/ROADMAP.md); architecture decisions are in [docs/adr/](docs/adr/),
and the full docs map (PRD ↔ ROADMAP ↔ ADRs) is in [docs/INDEX.md](docs/INDEX.md). The public contract surface
is in [packages/contracts/src/contracts-map.md](packages/contracts/src/contracts-map.md); a static contracts-map
page lives at [landing/m15-contracts/index.html](landing/m15-contracts/index.html).

**Live landing page:** [bai7w0jcu7s8e.space.minimax.io](https://bai7w0jcu7s8e.space.minimax.io) — a
public static showcase of the brand. The dynamic survey + admin app is run locally via
`pnpm local:up` (see below).

## What it will do

| Area                  | Summary                                                                                                                                                  | PRD      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Mobile assessment     | Loginless secure invite, one question per screen, adaptive branching, FR/EN, about 8 minutes                                                             | §4–§7    |
| AI maturity model     | Three axes (literacy, practice, organisational readiness) plus a task-level opportunity index; levels L0–L5 are descriptive, not certification           | §6       |
| Workflow discovery    | Last 7 days of work, friction, tools, hand-offs, safety classification                                                                                   | §7       |
| AI-assisted synthesis | Sensitivity classification → schema-validated extraction → themes → contradictions → interview prompts, every claim linked to its source; human approval | §10      |
| Opportunity register  | From employee evidence to validated, measured outcomes (detected → … → measured / rejected)                                                              | §11      |
| Governance & security | Tenant isolation, minimal personal data, audit trail, retention/deletion, prompt-injection resilience, launch gates                                      | §15, §25 |
| Cost management       | Per-tenant AI budgets, model routing, unit economics, three separate ledgers                                                                             | §26      |
| Audit quality & value | Audit-quality rubric, 30/60/90-day measurement, honest ROI formulas                                                                                      | §29–§30  |

## Repository layout

```
apps/web            Next.js admin workspace + employee mobile survey (PWA later)
apps/mobile         Expo app (Phase 3, only if needed)
services/ai         AI pipeline worker, prompt versions, evaluation suite
packages/ui         Accessible components and design tokens
packages/domain     Entities, rules, roles
packages/contracts  Zod / JSON schemas, API and event types
packages/i18n       FR / EN copy and question items
packages/analytics  Scoring, evidence and cost/outcome formulas
infra/db            PostgreSQL migrations, row-level security, synthetic fixtures
infra/deploy        Self-hosted and single-tenant deployment templates
tests/e2e           Playwright device sizes and cross-tenant deny tests
docs                PRD, architecture decisions, threat model, data dictionary
```

## Principles

1. Problem-first, AI-open — AI is one option among simplification and plain automation.
2. Evidence before claims — no AI-generated counts, timings or ROI; self-reported until verified.
3. People and data protected — no ranking, aggregation thresholds, human approval, EU hosting when required.
4. No lock-in — self-hostable, portable exports, documented APIs, provider-neutral AI.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
AI coding agents: read [AGENTS.md](AGENTS.md) first. UI work follows [docs/UI_RULES.md](docs/UI_RULES.md)
(MUI themed from our tokens, light and dark, checked by `pnpm style-guard` and Playwright).

## Run it locally

The local one-command runner brings up the entire stack on a single machine — embedded
PostgreSQL 17 with the migrations, the seeded synthetic tenants, and a production build of the
Next.js app. No Docker, no external services. See [ADR 0006](docs/adr/0006-local-dev-runner.md)
for the rationale and the architecture.

Prerequisites: Node 20+, pnpm 9+.

```bash
# 1. Install dependencies (first time only).
pnpm install --frozen-lockfile

# 2. Build the web app (first time only, or after editing apps/web).
pnpm --filter @evolai/web build

# 3. Bring the stack up. Auto-discovers free ports and prints them when READY.
pnpm local:up
#   READY postgres=postgres://auditai:auditai@127.0.0.1:54340/evolai_local;
#          web=http://127.0.0.1:3101;
#          admin=http://127.0.0.1:3101/admin/engagements

# 4. In another terminal, exercise the stack end-to-end.
export LOCAL_WEB_URL=http://127.0.0.1:3101           # or whatever `local:up` printed
export DATABASE_URL=postgres://auditai:auditai@127.0.0.1:54340/evolai_local
pnpm local:smoke   # walks /about → /s/[token] → 6 answers → /done → /admin/engagements

# 5. Tear down.
pnpm local:down
```

Useful subcommands:

| Command             | What it does                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm local:up`     | Boot embedded Postgres + apply migrations + build (if needed) + start `next start`                            |
| `pnpm local:status` | Probe web and Postgres; exit 0 only when both respond (reads ports from `/tmp/evolai-local-stack.ports.json`) |
| `pnpm local:smoke`  | End-to-end walk: about → welcome → 6 answers → done → admin; needs `LOCAL_WEB_URL` + `DATABASE_URL`           |
| `pnpm local:reset`  | Drop the database, recreate, re-apply migrations + seed                                                       |
| `pnpm local:down`   | Stop the `next start` process and the embedded Postgres data dir                                              |

If port `3101` is already taken, the runner discovers a free port and writes it to
`/tmp/evolai-local-stack.ports.json`; `pnpm local:status` reads that file so it always probes the
right address.

The CI workflow does not depend on the local runner: it uses a `postgres:17` service container on
port 54329 and `pnpm test` (unit + integration). See `.github/workflows/ci.yml`.

## License

[Apache-2.0](LICENSE) (see [ADR 0001](docs/adr/0001-license-and-stack.md); the PRD keeps AGPL-3.0 as an open option).
