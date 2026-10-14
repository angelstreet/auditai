# auditAI

> Working name. Discover how work really happens. Build AI confidence. Turn friction into measurable improvements.

An **open-source platform for evidence-based AI adoption audits and AI change enablement**. Employees answer short,
adaptive, mobile questionnaires; auditors review AI-assisted, source-linked findings and map workflows; company leaders
get validated opportunities, an adoption roadmap, governance artefacts and measured outcomes.

It is **not** an employee performance-ranking tool: it assesses work practices, readiness and improvement opportunities,
with privacy thresholds, human review of every AI output, and strict tenant isolation.

**Status:** specification and repository skeleton. Nothing is built yet. The product requirements are in
[docs/PRD.md](docs/PRD.md).

## What it will do

| Area | Summary | PRD |
|---|---|---|
| Mobile assessment | Loginless secure invite, one question per screen, adaptive branching, FR/EN, about 8 minutes | §4–§7 |
| AI maturity model | Three axes (literacy, practice, organisational readiness) plus a task-level opportunity index; levels L0–L5 are descriptive, not certification | §6 |
| Workflow discovery | Last 7 days of work, friction, tools, hand-offs, safety classification | §7 |
| AI-assisted synthesis | Sensitivity classification → schema-validated extraction → themes → contradictions → interview prompts, every claim linked to its source; human approval | §10 |
| Opportunity register | From employee evidence to validated, measured outcomes (detected → … → measured / rejected) | §11 |
| Governance & security | Tenant isolation, minimal personal data, audit trail, retention/deletion, prompt-injection resilience, launch gates | §15, §25 |
| Cost management | Per-tenant AI budgets, model routing, unit economics, three separate ledgers | §26 |
| Audit quality & value | Audit-quality rubric, 30/60/90-day measurement, honest ROI formulas | §29–§30 |

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
AI coding agents: read [AGENTS.md](AGENTS.md) first.

## License

[Apache-2.0](LICENSE) (see [ADR 0001](docs/adr/0001-license-and-stack.md); the PRD keeps AGPL-3.0 as an open option).
