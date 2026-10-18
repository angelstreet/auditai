# 0007 - AI pipeline (M9): rule-based first cut, evidence contract, approval gate

- Status: Accepted (the model-backed route is in [0029](0029-llm-synthesis-provider-abstraction.md))
- Date: 2026-10-15
- Deciders: maintainers
- Related: [0001](0001-license-and-stack.md), [0003](0003-rls-and-tenant-isolation.md), [0004](0004-mobile-survey-and-admin.md), [0005](0005-admin-data.md), [0006](0006-local-dev-runner.md)

## Context

PRD §10 defines an AI pipeline that, for every submitted survey, produces:

- a sensitivity classification (`public` / `internal` / `sensitive`);
- a set of themes, each with a `claim`, `sourceKind`, `sourceId`, and `quote` (FR-12);
- a list of contradictions between themes (so the auditor can probe them);
- a set of interview prompts for the next round.

PRD §10 also says: nothing the AI produces is published to the client without a human
approving it. The model is a tool that drafts; the auditor is the decision-maker.

The deliverable for M9 is a working pipeline that can be run end-to-end against the
synthetic seed and produce a row in a new `analyses` table per submission. PRD §26.2
forbids hardcoded model prices, so the pipeline is wrapped behind a `model_route`
identifier that can be swapped without changing the schema or the worker.

Before M9 there was no AI surface in the repo at all. We had to choose:

1. **LLM on day one.** Wire an OpenAI / Anthropic / local model behind the worker. The
   pipeline is correct, but the worker can no longer run inside the local stack
   without an API key, and the smoke becomes non-deterministic. PR review now needs
   a key. CI cannot run the worker at all.
2. **Rule-based first cut.** Implement the four pipeline steps (`classifySensitivity`,
   `extractThemes`, `findContradictions`, `buildInterviewPrompts`) as pure
   deterministic functions that operate on the seeded `answers` and `question_items`.
   LLM support is a future swap. The worker, the smoke, and CI all work without
   keys, and the schema / `model_route` / evidence contract are designed so the LLM
   implementation can be added without changing the surrounding shape.
3. **Skip the worker, write the schema only.** Block M9 on a real LLM provider
   decision. Rejected because it leaves the data model untested and the auditor
   without a working artifact.

We chose option 2.

## Decision

### 1. New table `analyses` (migration `0005_analyses.sql`)

```
analyses(
  id, tenant_id, engagement_id, submission_id, version, sensitivity,
  theme_count, prompt_count, payload_json, evidence_json, model_route,
  approved_at, approved_by, created_at, updated_at,
  UNIQUE (submission_id, version)
)
```

- `payload_json` is the schema-validated output of the AI worker. We store the whole
  payload as `jsonb` so the worker can evolve the shape without further migrations.
- `sensitivity`, `theme_count`, `prompt_count` are denormalised counters so the
  auditor UI can filter / sort without unpacking the payload.
- `evidence_json` is the flat list of `{claim, sourceKind, sourceId, quote}` records
  (every claim, deduped by `sourceId`). The auditor UI must render this list and let
  the auditor click through to the source row.
- `model_route` is the identifier of the model that produced the payload (e.g.
  `rule-based/v1`, `openai/gpt-5.1`, `anthropic/claude-opus-4-7`). It is set by the
  worker; the schema does not constrain it.
- `approved_at` / `approved_by` are the human-approval gate (PRD §10). They start
  NULL; the audit UI sets them.
- `UNIQUE (submission_id, version)` lets the worker re-run idempotently: `INSERT
... ON CONFLICT (submission_id, version) DO UPDATE`. The `version` column is for
  future re-analyses (e.g. after a model upgrade); M9 always writes `1`.

Row-level security:

- `ENABLE + FORCE ROW LEVEL SECURITY` so even the table owner is subject to policies
  in production. (Migration runs as the migration owner; the application uses
  `auditai_app` which is `NOSUPERUSER NOBYPASSRLS`.)
- `SELECT` / `INSERT` / `UPDATE`: allow when `app_is_service_account()` OR
  `tenant_id = app_current_tenant_id()`. The auditor UI uses a per-tenant session;
  the worker uses a service account.
- `DELETE`: service-account only. Clients can never delete an analysis.

### 2. New package `@auditai/ai` (monorepo, `services/ai`)

```
services/ai/
  src/
    pipeline.ts        pure pipeline: runPipeline + 4 step functions + types
    pipeline.test.ts   7 vitest unit tests
    worker.ts          pg client wrapper, processSubmission + processAllSubmitted
    index.ts           public re-exports
  scripts/
    smoke.ts           CLI: pnpm --filter @auditai/ai run smoke
  package.json         ESM, deps: @auditai/contracts, pg
```

The four pipeline steps are exposed individually so the unit tests can target them
and an LLM implementation can replace them one at a time:

| Step | Function                        | Inputs                       | Output                                                                         |
| ---- | ------------------------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| 1    | `classifySensitivity(items)`    | `QuestionItemRow[]`          | `'public' \| 'internal' \| 'sensitive'` (max of all items)                     |
| 2    | `extractThemes(input)`          | submission + answers + items | `AnalysisTheme[]` grouped by axis, each with `evidence: AnalysisClaim[]`       |
| 3    | `findContradictions(themes)`    | `AnalysisTheme[]`            | `{themeA, themeB, explanation}[]` (mixed high + low maturity on the same axis) |
| 4    | `buildInterviewPrompts(themes)` | `AnalysisTheme[]`            | `AnalysisInterviewPrompt[]` (2 prompts targeting the lowest-evidence axis)     |

`runPipeline(input)` composes the four steps and returns:

```ts
{
  version: 1,
  sensitivity,
  themes,
  contradictions,
  interviewPrompts,
  evidence,        // flat, deduped by sourceId
}
```

### 3. Evidence contract (FR-12, PRD §10)

Every claim in the payload is an `AnalysisClaim`:

```ts
{
  claim: string;
  sourceKind: 'answer' | 'question_item';
  sourceId: string;
  quote: string;
}
```

- `sourceKind` is one of `'answer'` or `'question_item'`. The auditor UI must not
  accept a claim without `sourceKind`.
- `sourceId` is the primary key of the source row. The auditor UI must render a link
  to that row.
- `quote` is a short string captured at analysis time (e.g.
  `answer.value_json={"value":"high"}`). It is the auditor's first verification
  step; the link is the second.

The worker also writes the flat `evidence_json` column so the auditor UI can render
a single list without unpacking the themes.

### 4. Model route (PRD §26.2)

The worker accepts a `modelRoute` option (default `'rule-based/v1'`) and writes it
to the `analyses.model_route` column. The schema does not constrain the value, so
adding a new route (`openai/gpt-5.1`, `anthropic/claude-opus-4-7`,
`local/llama-3.3-70b`) requires:

1. a new step implementation in `services/ai/src/` (e.g. `pipeline.llm.ts`);
2. a worker entry point that picks the implementation based on the route;
3. (optional) a small ADR appending the route to a registry.

No model prices are hardcoded anywhere. The `model_route` identifier is the only
contract between the worker and the model registry / cost reporter (not yet built).

### 5. Human-approval loop (PRD §10, FR-12)

- The worker writes `approved_at = NULL`. Nothing about the analysis is exposed
  to clients until an auditor approves it.
- The audit UI (M11+) is responsible for rendering the `evidence_json` list and the
  `payload_json.themes` and gating the publish action behind a confirm dialog that
  names the engagement and the model route.
- The worker itself never reads `approved_at`. It is a write-only pipeline.

### 6. Service-account boundary (PRD §25.1)

The worker runs as `auditai_app` with `app.is_service_account = 'on'`. This is the
same role the survey submission flow uses. The RLS policy on `analyses` permits
service-account SELECT / INSERT / UPDATE on every tenant's rows, so the worker can
fan out across tenants without a per-tenant GUC. Cross-tenant deny tests are
covered by `tests/db/isolation.test.ts` for the existing tables; M11 will extend
the isolation tests for `analyses`.

Note: `SET LOCAL app.is_service_account = 'on'` was the original choice but it is
scoped to a single transaction. Because the worker issues several auto-committed
statements (`SET ROLE`, `SET`, the load query, the insert), we use the session
form `SET app.is_service_account = 'on'`. The session ends when the client closes,
so the risk of leaking the GUC to another request on a pooled connection is real
but mitigated by `pg`'s default behaviour of returning the connection to the pool
without carrying session state. (Future M9.x: explicit `RESET app.is_service_account`
in a `finally` if the worker is ever embedded in a request handler.)

## Consequences

- M9 ships a working pipeline that exercises the schema, the worker, the smoke,
  and the unit tests without an LLM. CI runs it; local contributors run it via
  `pnpm local:smoke`.
- The LLM implementation is a contained swap: write `pipeline.llm.ts` that exports
  the same four step functions, change the worker's import, and ship. The schema
  and the audit UI do not need to change.
- The evidence contract (`sourceKind` + `sourceId` + `quote`) is a hard contract.
  LLM-generated claims that fail the contract are rejected at insert time (the
  `AnalysisPayload` is Zod-validated before the SQL goes out — added in M9.x).
- The auditor UI must render the `evidence_json` list and gate publishing on
  approval. This is M11 work; M9 only writes the rows.
- `model_route` is currently free-text. A migration that adds a check constraint
  is rejected because it would force every future route through a schema change.
  We accept the looseness and rely on code review.

## Alternatives considered

- **Call an LLM in CI.** Rejected: non-deterministic, requires a key, and CI cannot
  sign off on a model response.
- **Store the analysis on the `submissions` row.** Rejected: blurs the
  submission / analysis boundary, blocks the M11 re-analysis flow, and makes
  approval columns awkward.
- **Skip the `analyses` table, write the payload to a JSON file.** Rejected: PRD
  §15 says evidence must be tenant-scoped and durable; a file system does not give
  us that.
- **Add a `check (model_route in (...))` constraint.** Rejected: forces a
  migration for every new model. The free-text column is fine; the application is
  the only writer.
