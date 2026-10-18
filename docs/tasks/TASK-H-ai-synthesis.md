# TASK-H — LLM-backed synthesis behind a provider abstraction (Gate B) (model: opus)

## Ground rules

- Public repo: no secrets, keys, IPs, hostnames, client names, real data. Read AGENTS.md, docs/PRD.md and the ADRs you touch. Use `corepack pnpm`; put a `pnpm` shim on PATH if turbo cannot find it.
- Own git worktree + branch off origin/main. Owner rule: when gates pass (`format:check`, `lint`, `typecheck`, `test`, `leak-scan`, `style-guard`, relevant smokes and Playwright) rebase, merge to main yourself, confirm main CI green with `gh run list`. Commit by explicit path. Add an ADR (use the next free number at merge time; other workers add ADRs in parallel).
- Never commit credentials. Real model access comes only from environment variables set by the owner.
- Owner priorities: simple, minimal clicks, plain short words for respondents, FR and EN equal, one font and the design tokens (ADR 0025, 0027). Wording polish and mascot names are deferred; do not ask questions.
- End with `STATUS: done — ...` / `needs-owner: ...` / `blocked: ...`.

## Context

services/ai/src/pipeline.ts is rule-based ("does not call an LLM"). PRD section 10 and ROADMAP Gate B require: redaction, prompt-injection tests, source traceability, cost ceiling, fail closed, no cross-tenant data in model calls, provider abstraction (EU-hosted or self-hosted possible), model/prompt versions stored, never fabricate ROI/counts. AGENTS.md: structured outputs with schemas, source links for every claim, human approval before anything client-facing, fail closed when a citation or an approved model route is missing, never hardcode prices.

## Do

1. Provider interface (TypeScript) with: a deterministic **mock/fixture provider** (used in all tests and CI, no network), the existing rule-based provider as fallback, and one real HTTP adapter for an OpenAI-compatible chat endpoint and one for the Anthropic Messages API, configured only by env (base URL, key, model id, region label). Approved model routes are an allowlist in config (ADR); a call to an unlisted route throws.
2. Pipeline steps per PRD: classify sensitivity, extract facts to a strict JSON schema (zod, reject and retry once on invalid output, then fail closed), cluster themes, surface contradictions, propose interview questions, propose opportunities. Every claim carries sourceKind, sourceId and a quote that must be a verbatim substring of the cited answer; verify mechanically and drop or label "unsupported" any claim that fails. Numbers (volume, time, benefit) are labelled self-reported and copied from answers, never computed by the model.
3. Redaction before any model call: strip emails, phone numbers, names from a per-tenant list and obvious identifiers; map to stable placeholders and restore only inside the tenant; tests with synthetic PII. Only that tenant's records enter a call; assert it.
4. Prompt-injection: treat answers as data (delimited, instructions to ignore embedded commands), plus a test suite of hostile synthetic answers (ignore previous instructions, exfiltrate other tenant, output fake citations, fabricated ROI). The suite runs on the mock provider with scripted hostile model outputs, and must prove the validators and citation checks block them. Document how to run it against a real model manually.
5. Cost ceiling: token estimate before the call, per-analysis and per-tenant-per-month caps from config, refuse over the cap, record tokens and cost using timestamped configurable rates (table or config, never hard-coded prices). Store model name/version, prompt template version, input record ids, output JSON, evidence spans, time in the analyses row (new forward migration if needed; do not edit old ones).
6. Human approval: output lands as draft for the auditor review screen that already exists; nothing client-facing without approval. Show provider, model and "AI draft" clearly in the auditor view.
7. Evaluation: a small gold set of synthetic FR and EN answers with expected themes, and a script `pnpm ai:eval` reporting grounded-claim rate and hallucination rate (target: 100 percent of kept claims grounded). Wire the mock-based eval into CI. Observability must not log prompts or answers (redacted by default).
8. ADR with the threat model, allowlist, redaction approach, and the owner steps to turn on a real route (which env vars, which regions). Update ROADMAP Gate B status honestly (what is proven on the mock vs what needs a real-model run by the owner).
