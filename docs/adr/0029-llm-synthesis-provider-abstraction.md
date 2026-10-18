# 0029 - Model-backed synthesis behind a provider abstraction (Gate B)

- Status: Accepted
- Date: 2026-10-18
- Deciders: maintainers
- Related: [0007](0007-ai-pipeline.md) (rule-based first cut, evidence contract), [0008](0008-auditor-review.md) (auditor review and approval), TASK-H

## Context

ADR 0007 shipped a rule-based pipeline and left the model swap for later. PRD §10 and ROADMAP
Gate B ask, before any model sees survey answers, for: redaction, prompt-injection defences
with tests, source traceability for every claim, a cost ceiling, fail-closed behaviour, no
cross-tenant data in model calls, a provider abstraction that allows an EU-hosted vendor or a
self-hosted model, and storage of model and prompt versions. AGENTS.md adds: structured
outputs with schemas, human approval before anything client-facing, never hard-code prices.

## Decision

### Provider abstraction (`services/ai/src/llm/providers.ts`)

One interface, `ModelProvider.complete({system, user, maxOutputTokens})`, returning text,
token usage and the model version the provider reports. Implementations:

| Route (`provider/model`) | What it is                                                                 | Where it runs             |
| ------------------------ | -------------------------------------------------------------------------- | ------------------------- |
| `rule-based/v1`          | The ADR 0007 pipeline. Default and fallback; never calls a model.          | everywhere, no key        |
| `mock/fixture-v1`        | Deterministic stand-in that reads the prompt's data block and answers JSON | tests, CI, `pnpm ai:eval` |
| `openai-compatible/<id>` | Any OpenAI-compatible `/chat/completions` endpoint (EU vendor, self-host)  | owner-enabled only        |
| `anthropic/<id>`         | Anthropic Messages API through the official SDK (`@anthropic-ai/sdk`)      | owner-enabled only        |

The Anthropic adapter sends no `temperature` (current models reject it) and no server-side
`fallbacks`: a fallback would answer with a model that is not on the allowlist, so a refusal
fails closed instead.

### Allowlist (`services/ai/config/ai.config.json`, `llm/config.ts`)

A route is approved only if provider, model id, region label **and** base URL all match one
entry of `approvedRoutes`. The public config lists only `rule-based/v1` and `mock/fixture-v1`.
The owner adds real routes in a private copy named by `EVOLAI_AI_CONFIG`. An unlisted route
throws `RouteNotApprovedError` when the route is resolved, and every provider checks the
allowlist again before each call. The worker then records a failure and writes no row.

### Pipeline (`llm/llmPipeline.ts`), each step can stop the run

1. **Tenant check.** Every answer and question item must carry the submission's `tenant_id`
   (the worker also filters by tenant in SQL). Mixed or unlabelled rows throw
   `TenantIsolationError` before any call.
2. **Route check** against the allowlist.
3. **Sensitivity.** The rule-based classifier, raised to `sensitive` when redaction found PII.
4. **Redaction** (below).
5. **Cost ceiling** (below).
6. **One structured call.** The model must return one JSON object (facts, themes,
   contradictions, interview questions, opportunities), validated by a strict zod schema
   (unknown keys rejected). Invalid output gets exactly one retry, with only the schema error
   paths fed back. A second failure throws `OutputValidationError` (fail closed).
7. **Grounding** (`llm/verify.ts`):
   - a fact survives only if its `sourceId` is an answer sent in this call and its `quote`
     is a verbatim substring of that answer's text;
   - a number survives only if it is copied from the fact's quote, and is then stored as
     `selfReported: true`;
   - themes, contradictions, questions and opportunities survive only if what they cite
     survived, and every number in their text appears in their cited quotes, so the model
     cannot fabricate ROI, counts or timing;
   - every dropped item goes into `unsupported` with a fixed reason string.
8. **Restore** placeholders for this tenant only, and return a draft (`payload.version = 2`,
   `aiDraft: true`).

Contradictions, themes and opportunities cite facts by id, and facts cite answers. So every
claim the auditor sees links back to a source answer and a checked quote (the FR-12 contract
from ADR 0007 is unchanged).

### Redaction (`llm/redaction.ts`)

Before the prompt is built, these are replaced with stable placeholders (`[EMAIL_1]`, `[NAME_2]`,
...):

- emails, phone numbers (8+ digits with separators), IBAN-like strings and 9+ digit identifiers;
- names from the tenant's own list in the new `ai_redaction_terms` table (RLS like `analyses`).

Text a respondent typed in the shape of a placeholder is neutralised first. The mapping lives
in memory for one analysis, and `restore` refuses any other tenant. Restored quotes go back
into that tenant's own `analyses` row, next to the answers they came from.

### Prompt-injection defences (`llm/prompt.ts`)

- Answers are serialised as a JSON array between two marker lines carrying a random nonce, so
  an answer cannot close the block.
- The system prompt states that the data is untrusted and its instructions are ignored.
- The real defence is mechanical: whatever the model does, only cited, quoted, number-checked
  claims are stored, and only as a draft.

`llm/injection.test.ts` runs hostile synthetic answers against the mock provider with
scripted hostile outputs, covering:

- ignore-previous-instructions answers;
- a fake `>>>SURVEY_DATA` terminator;
- citations of another tenant's record;
- fake quotes;
- fabricated ROI in themes and opportunities;
- invented numbers;
- extra keys (`approved`, leaked prompt);
- prose around the JSON;
- placeholder abuse.

Every case is blocked.

### Cost ceiling (`llm/costs.ts`)

- Before the call, input tokens are estimated (about 3 characters per token). The worst case
  (two calls at the output cap) is checked against `maxInputTokensPerAnalysis`,
  `maxCostPerAnalysis` and `maxCostPerTenantMonth`.
- Monthly spend is summed from `analyses.cost_amount` for the calendar month.
- Costs use the latest `rates[]` entry whose `effectiveFrom` is not after the call time. No
  rate for the route means no call. Rate and cap currencies must match.
- No price is hard-coded; the public config only rates the mock.

### Storage (migration `0016_analyses_ai_metadata.sql`, forward-only)

The migration adds these columns to `analyses`:

- `model_provider`, `model_name`, `model_version` (as reported by the provider), `model_region`;
- `prompt_version` (`synthesis-v1`);
- `input_record_ids` (answer and question item ids sent);
- `unsupported_json`;
- `input_tokens`, `output_tokens`;
- `cost_amount`, `cost_currency`, `rate_effective_from`;
- `generated_at`, `duration_ms`.

The output JSON and evidence spans stay in `payload_json` and `evidence_json`. A re-run
resets `approved_at`/`approved_by` to NULL, since a new draft needs a new approval.

### Human approval and auditor view

Model output always lands with `approved_at` NULL. The existing review screen now shows:

- an "AI draft" / "Brouillon IA" pill;
- a line with provider, model version, region, prompt version, tokens and cost;
- the number of items the checks removed;
- the proposed opportunities.

Approval stays the existing human action. Playwright: `apps/web/e2e/ai-draft.spec.ts` (EN and FR).

### Observability (`llm/log.ts`)

The log event type only has fields for ids, counts and fixed reasons, so prompts, answers and
model text cannot be logged through it. A test asserts that no answer text reaches the logger.
HTTP errors from a provider never echo the response body.

### Evaluation (`pnpm ai:eval`, `services/ai/eval/gold.json`)

The gold set has six synthetic items, three FR and three EN, two of them hostile. Each lists
its expected themes. The script reports, per item and overall:

- **grounded-claim rate**: every claim the auditor would see, re-checked against the original
  answer;
- **hallucination rate**: items the validators dropped, over items proposed;
- **theme recall**: mock only;
- tokens and cost.

The whole run counts as one tenant month, so the monthly cap bounds its total spend. CI runs it
on the mock and fails on any ungrounded kept claim, any error or a missed theme.

## Threat model (summary)

| Threat                                              | Control                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| Respondent injects instructions in an answer        | Nonce-delimited JSON data block, system rule, mechanical validators, draft only |
| Model invents facts, quotes, ROI, counts            | Verbatim-quote check, number-in-quote check, drop + `unsupported`               |
| Model cites another tenant or a record not sent     | `sourceId` must be in this call's inputs; only one tenant's rows are loaded     |
| Cross-tenant data in a call                         | SQL tenant filter, `assertSingleTenant`, per-tenant redaction mapping           |
| PII sent to a vendor                                | Redaction before the prompt; sensitivity raised to `sensitive`                  |
| Unapproved model / region / endpoint                | Four-field allowlist, checked at resolve time and before each call              |
| Runaway cost                                        | Pre-call worst-case check against per-analysis and per-tenant-month caps        |
| Model output reaches the client unreviewed          | `approved_at` NULL, "AI draft" label, existing approval flow                    |
| Prompts or answers leak into logs                   | Typed log events with ids and counts only                                       |
| Malformed output                                    | Strict schema, one retry, then fail closed                                      |
| Vendor safety refusal or silent fallback to a model | Refusal fails closed; no server-side fallback                                   |

## Owner steps to turn on a real route

1. Put the key in a gitignored `.env` outside the repo, for example `~/.evolai.env`, as
   `ANTHROPIC_EVOLAI_API_KEY=...`. The adapter reads `EVOLAI_AI_API_KEY` first and, for the
   `anthropic` provider, falls back to `ANTHROPIC_EVOLAI_API_KEY`. For an OpenAI-compatible
   vendor set `EVOLAI_AI_API_KEY`. Never commit either.
2. Copy `services/ai/config/ai.config.json` outside the repo. In the copy:
   - add the route to `approvedRoutes`: `provider`, `model`, `region` label, and `baseUrl`
     (`null` for the vendor's default endpoint; an EU or self-hosted URL otherwise);
   - add a timestamped `rates[]` entry from the vendor's current price page;
   - set `caps` in the same currency.
3. Run with `EVOLAI_AI_CONFIG=<copy>`, `EVOLAI_AI_PROVIDER` (`anthropic` or
   `openai-compatible`), `EVOLAI_AI_MODEL`, `EVOLAI_AI_REGION` and, if not null,
   `EVOLAI_AI_BASE_URL`.
4. Regions: pick a route whose processing location matches the client contract. For EU
   processing, use an EU-hosted OpenAI-compatible vendor or a self-hosted server with its
   `baseUrl` and an `eu-*` region label. The region label is recorded per analysis; it is a
   label the owner vouches for, not something the code can verify.
5. To add names to redact for a tenant, insert rows into `ai_redaction_terms` (no admin UI yet).

### Manual run on a real model

Synthetic gold set only, never real survey answers:

```sh
set -a; . ~/.evolai.env; set +a
EVOLAI_AI_EVAL_LIVE=1 EVOLAI_AI_CONFIG=/path/outside/repo/ai.live.json \
EVOLAI_AI_PROVIDER=anthropic EVOLAI_AI_MODEL=claude-haiku-5-5 EVOLAI_AI_REGION=global \
pnpm ai:eval
```

To run the hostile answers against a real model, use the same environment: the gold set
already contains the two hostile items (`en-hostile`, `fr-hostile`).

## Real-model results (2026-10-18)

Setup for every run:

- route `anthropic/claude-haiku-5-5`, region label `global`, default endpoint;
- private config outside the repo;
- rate 0.10 / 0.50 USD per million input / output tokens, `effectiveFrom` 2026-10-06, taken from
  the vendor's published rate;
- caps: 0.25 USD per analysis and 2 USD for the run;
- synthetic gold set only.

| Run                                          | Key used              | Grounded-claim rate | Hallucination rate (dropped / proposed) | Errors | Tokens in / out | Cost (USD) |
| -------------------------------------------- | --------------------- | ------------------- | --------------------------------------- | ------ | --------------- | ---------- |
| 3 (official, 2026-10-18T09:14Z)              | dedicated EvolAI key  | 100 %               | 5.0 % (2 / 40)                          | 0      | 6106 / 6959     | 0.004090   |
| 1 (before the owner moved to the EvolAI key) | another project's key | 100 %               | 7.0 % (3 / 43)                          | 0      | 6106 / 7523     | 0.004372   |
| 2 (same)                                     | another project's key | 100 %               | 2.7 % (1 / 37)                          | 0      | 6120 / 6531     | 0.003878   |

- **Drops.** In run 3 both drops were French interview questions with a number not found in
  their cited quotes. In run 2 the drop was an English one of the same kind.
- **Retries.** Every call passed the schema on the first attempt.
- **Theme recall** printed 0 % on the real model. That is expected: the gold set's expected
  theme ids are the mock's ids, and a real model names its own themes. Real-model theme quality
  still needs a human read; this run proves grounding, not theme quality.
- **Total spend** across the three runs was about 0.012 USD.

## Consequences

- Gate B controls are implemented and proven on the mock in CI: redaction, injection suite,
  traceability, cost ceiling, fail closed, tenant check, approval draft. Grounding is also
  proven on one cheap real model with synthetic data.
- **Not yet proven:**
  - theme quality on a real model;
  - an EU-hosted or self-hosted route;
  - behaviour on real survey answers (out of scope until a client contract approves a route);
  - an admin UI for `ai_redaction_terms`.
- Regex redaction misses names not on the tenant list and unusual identifier formats. The
  allowlist plus the human review are the backstop.
- The worker still defaults to `rule-based/v1`. Nothing changes for local stacks, smokes or
  deploys until the owner sets the env.

## Alternatives considered

- **One model call per pipeline step.** More calls, more cost and more injection surface. The
  structured single call with mechanical checks gives the same traceability.
- **Trust the model's citations.** Rejected: PRD §10 requires fail closed; the verbatim check is
  cheap and decisive.
- **Vendor structured-output modes only.** They differ by vendor and do not check quotes or
  numbers. Kept the provider-neutral zod check; a vendor mode can be added inside an adapter.
- **Server-side model fallback on refusal.** Rejected: it would bypass the allowlist.
- **Prices in code.** Forbidden by PRD §26.2; rates are timestamped config.
