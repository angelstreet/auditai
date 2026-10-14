# AGENTS.md

Rules for AI coding agents working in this repository.

## This repository is public

- Never commit credentials, API keys, tokens, `.env` files, client names, real employee data, real survey answers,
  pricing quotes for named clients, IP addresses or host names. Fixtures are synthetic and obviously fake.
- Read `git diff --staged` before every commit and check for the above.

## Source of truth

- Product requirements: [docs/PRD.md](docs/PRD.md). Architecture decisions: [docs/adr/](docs/adr/).
- Record every significant technical choice as a new ADR (context, decision, alternatives, consequences).

## How to work

- Smallest verifiable step first; tests with every change (unit, plus Playwright for UI and tenant-isolation paths).
- Tenant isolation and privacy rules (PRD §15, §25.1) are acceptance criteria, not later polish.
- AI features: structured outputs with schemas, source links for every claim, human approval before anything
  client-facing, fail closed when a citation or an approved model route is missing (PRD §10).
- Never hardcode current model prices; costs come from timestamped, configurable rates (PRD §26.2).

## When to ask the owner

- Do not stop to ask to start a plan you wrote, pick your recommended option, merge your own tested work, push, or
  rerun a test: do it and report it. Corrections come at the end.
- Ask only for: anything irreversible, credentials or secrets, money, real client or personal data, licence changes,
  or a fact only the owner has.
- Run long jobs as harness-tracked background commands; waiting on your own job is not "blocked".
- End every turn with one line: `STATUS: done — <outcome>` / `STATUS: needs-owner: <question> [options]` / `STATUS: blocked: <what>`.
