# 0043 - Optional AI draft of the report summary, run by the worker

- Status: Accepted
- Date: 2026-10-19
- Related: [0029](0029-llm-synthesis-provider-abstraction.md), [0041](0041-audit-report-improvement-catalogue-readiness.md), TASK-V

## Context

The auditor writes the executive summary of the audit report (ADR 0041). The screen already offers a rule-based
first draft (score, the findings raised by most people, the first-ranked opportunities). TASK-V allows an optional
model draft "behind the provider abstraction, always a draft". PRD §10 and ADR 0029 set the rules: provider
abstraction, approved routes only, redaction, cost caps, structured output, every claim cited, no invented
numbers, fail closed, human approval before anything client-facing, mock provider in tests and CI.

## Decision

- **Where it runs.** In the AI worker package (`services/ai`), never in the web app, as an owner command:
  `pnpm --filter @evolai/ai report-draft -- --tenant <id> --engagement <id> --actor <user id>`. The web app
  keeps no model key and makes no model call. The route comes from the same environment and allowlist as the
  analysis worker (`EVOLAI_AI_PROVIDER`, `EVOLAI_AI_CONFIG`); the rule-based route refuses (the screen draft
  covers it).
- **What the model sees.** Aggregates only: the label, axis and head count of each approved finding raised by at
  least five people (`aggregateFindings`, now shared in `@evolai/domain`), and the titles of the accepted
  opportunities and their accepted steps, in priority order. Findings travel as `F1`, `F2`, ... ; the keys stay
  on our side. No answer, quote, respondent code or per-person value. Names on the tenant's "names to hide" list
  are replaced by placeholders and restored for this tenant only.
- **Checks.** Allowlisted route, cost caps (the month's spend counts analyses and earlier report drafts, recorded
  in the audit payload), a strict output schema `{"sentences":[{"text","cites":[...]}]}` with one retry, then
  per sentence: every cited finding must exist and every number must be one given in the data. Sentences that
  fail are dropped (counted); if none remain there is no draft.
- **Where it lands.** `audit_reports.ai_draft_json` (text, cited finding keys, route, model version, prompt
  version `report-summary-v1`, time) and one `report.ai_draft` audit row with route, tokens and cost, never the
  text. The editor shows it as "AI draft, not reviewed" with its route and prompt; "Use this draft" copies it and
  its citations into the summary, still editable, still behind the publish gate (citations checked, names and
  copied answer text refused). A published report is never touched.

## Alternatives considered

- **A button in the web app calling the model.** Simpler for the auditor, but puts a model key and egress in the
  public web function and bypasses the worker's single place for routes, caps and logs. Revisit with a job queue.
- **Model re-ranking of improvement steps.** Not needed yet: the rule-based ranking is explainable and the
  auditor edits impact and effort; a model could only add unverifiable judgement.
- **Sending the theme summaries or quotes for a richer text.** More context, but individual-level content would
  reach a report-level prompt; the analyses already used them under their own checks.

## Consequences

- Tests and CI use the mock route only (`reportDraft.test.ts`, `tests/db/src/reportDraft.test.ts`); no real
  model call in CI.
- Until an approved real route exists in the private config, the owner uses the rule-based screen draft; the AI
  draft is an option, not a dependency.
