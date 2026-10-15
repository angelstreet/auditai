# 0009 - Opportunity register + publish gate (M11)

- Status: Accepted
- Date: 2026-10-15
- Deciders: maintainers
- Related: [0001](0001-license-and-stack.md), [0003](0003-rls-and-tenant-isolation.md), [0005](0005-admin-data.md), [0007](0007-ai-pipeline.md), [0008](0008-auditor-review.md)

## Context

M10 closed the human-approval loop on the AI output (FR-08, PRD §10, §25.4). The auditor
opens an analysis, sees the themes / contradictions / interview prompts / evidence, and
approves with a rationale. Every approval writes a row to `audit_log`.

M11 turns the approved analysis into a trackable opportunity. The auditor creates an
opportunity from an analysis (the publish gate), then drives it through the workflow:

```
draft  ──> approved  ──> in_progress  ──> delivered
  │         │                │                │
  └─────────┴────────────────┴────────────────┴────> archived
```

M10 already created the `opportunities` table with the right shape (denormalised
`status` / `impact_score`, nullable `analysis_id`, FKs to engagements / analyses /
users); M11 adds the workflow transitions, the create-from-analysis flow, and the
admin UI. The full state machine is encoded once in the contracts package so the
UI and the data layer can never disagree.

## Decision

### 1. The workflow is encoded in the contracts package

```
opportunityStatusSchema          z.enum(['draft','approved','in_progress','delivered','archived'])
OPPORTUNITY_TRANSITIONS          { draft: ['approved','archived'], approved: ['in_progress','archived'],
                                   in_progress: ['delivered','archived'], delivered: ['archived'],
                                   archived: [] }
opportunityStatusTransitionSchema  refines({ from, to }) to ensure the edge exists
nextOpportunityStatuses(current)  returns the allowed next statuses for a given current
OPPORTUNITY_STATUS_LABELS         human-readable label per status
```

The data layer and the UI both call `nextOpportunityStatuses(current)` to render
exactly the right set of buttons. `opportunityStatusTransitionSchema.safeParse` is
the only place a transition can be rejected. The SQL `UPDATE` is unconditional;
the Zod refine throws before the SQL runs when the edge is invalid.

### 2. Create-from-analysis flow

`createOpportunityFromAnalysis(tenantId, analysisId, actorUserId, overrides)` is the
single entry point. It:

1. Loads the analysis + its `payload_json.themes`.
2. Pre-fills `title` with the first theme's label (or a fallback if the analysis has
   no themes), `description` with the theme summaries joined together, and `axis`
   with the first theme's axis.
3. Inserts the row with `status = 'draft'` and the overrides supplied by the
   auditor.
4. Writes an `opportunity.create` audit log row in the same transaction. The payload
   carries the `analysisId`, the `modelRoute`, the `sensitivity`, and the
   `evidenceCount` — everything the auditor needs to verify the link later.

The audit log is the source of truth for the link; the `opportunities.analysis_id`
FK is for UI queries.

### 3. Status transitions

`transitionOpportunity(tenantId, opportunityId, to, actorUserId, payload)` is the
single entry point for any non-create change. It:

1. Reads the current status (with `withTenant` so RLS gates the read).
2. Validates the `(from, to)` pair against `OPPORTUNITY_TRANSITIONS`.
3. Updates `status` + `updated_at`, and sets `archived_at = now()` if `to = 'archived'`,
   in a single `UPDATE` so the state and the archive flag are consistent.
4. Writes the audit log row: `opportunity.update` for any non-archive transition,
   `opportunity.archive` for the archive edge (so the trail distinguishes the
   archive action from a generic update).

The five transitions and their audit log action verbs:

| From          | To            | Action verb           |
| ------------- | ------------- | --------------------- |
| `draft`       | `approved`    | `opportunity.update`  |
| `approved`    | `in_progress` | `opportunity.update`  |
| `in_progress` | `delivered`   | `opportunity.update`  |
| any           | `archived`    | `opportunity.archive` |

The reverse edges (`approved` -> `draft`, `in_progress` -> `approved`, `archived`
-> anything) are all rejected by the Zod refine. The M11 smoke asserts the
`archived -> approved` edge is rejected.

### 4. Data layer validation: no `opportunitySchema.parse` on hot rows

The contracts package's branded ids use the `uuidV4Schema` regex, which requires
the version digit at position 13 to be `4`. The M4 synthetic seed uses UUIDs whose
version digit is `1` (e.g. `11111111-1111-4111-8111-111111111111`), so running the
hot rows through `opportunitySchema.parse` rejects them and the list page 500s
whenever any opportunity exists.

The fix is to skip `opportunitySchema.parse` in the data layer. The Postgres data
layer is the source of truth for the shape; the contract is enforced for **inputs**
(write requests, server-action payloads, API requests) and the data layer casts the
rows directly. A Zod-validated smoke test still covers the contract; the runtime
data layer is allowed to be looser because the database has already enforced the
column types.

The same pattern is used for the M9 analyses table (the `AnalysisListRow` is a
plain `interface` in `auditorData.ts`, not a Zod schema) and for the existing
`AdminEngagementSummary` (M6). Future writes that take user input still parse
through the Zod schemas — see the server actions.

### 5. The web surface

```
apps/web/src/app/admin/engagements/[id]/opportunities/
  page.tsx                                       list (status counts + table)
  [opportunityId]/page.tsx                       detail (description, metadata, transition form, audit trail)
  [opportunityId]/TransitionForm.tsx             client form for the status transition buttons
  [opportunityId]/../actions.ts                  server action: transitionOpportunityAction
  new/page.tsx                                   create form pre-filled from an analysis
  new/CreateOpportunityForm.tsx                  client form
  new/../actions.ts                              server action: createOpportunityAction
```

The "Create opportunity" link is on the analysis detail page next to the
"Approved at" line, and on the analyses list page (via "View opportunities"). The
opportunity detail page renders the full audit trail (every `opportunity.create` /
`opportunity.update` / `opportunity.archive` row for the opportunity). M11 lands
the data path; M12 (sponsor onboarding) renders the portfolio view that aggregates
the counts.

### 6. Service-account boundary (PRD §25.1)

Reads and writes both run in `withTenant(tenantId, ...)` so RLS gates them. The
server action resolves the actor by the same pattern as the M10 approve action:
prefer an `x-audit-actor-id` header, fall back to the first `auditor` membership
of the tenant. Gate C (SSO + MFA) replaces the fallback with the real session.

## Consequences

- The FR-08 loop is closed end-to-end: AI produces an analysis, the auditor
  approves, the publish gate creates an opportunity, the workflow moves the
  opportunity through `draft -> approved -> in_progress -> delivered`, and every
  step is auditable.
- The opportunity register is the single source of truth for the auditor's
  pipeline. M12's portfolio board reads it; M13's cross-team synergy detection
  reads it; M11.x's opportunity-level actions read it.
- The data layer does not enforce the `uuidV4Schema` brand on hot rows. This is a
  trade-off: the database is the source of truth for the schema, and the synthetic
  seed isn't v4. A future migration to v4 UUIDs (or a relaxation of the brand
  regex) would let us re-introduce the Zod parse, but until then the data layer
  relies on `pg`'s types and the smoke asserts the contract.
- The status workflow is a one-way DAG plus `archived`. Re-opening an archived
  opportunity is not possible from the UI; the workaround is to open a new
  opportunity and link it to the same analysis. This is intentional: the audit
  trail should show the new opportunity as a new decision, not a reversal.
- The `opportunity.update` audit log action verb covers three different edges
  (`draft -> approved`, `approved -> in_progress`, `in_progress -> delivered`).
  The payload always carries `from` and `to`, so the trail is reconstructable. If
  the auditor UI ever needs to filter the trail by edge, the payload makes that
  trivial.

## Alternatives considered

- **A single `opportunity.transition` action verb for every status change.**
  Rejected: the audit log should distinguish archive from update, and the
  transition form should be able to filter the trail by verb. Splitting the
  archive into its own verb keeps the trail readable.
- **A state machine library (xstate) instead of a Zod refine.** Rejected: the
  workflow has 5 states and 8 edges; a Zod refine is easier to read and test, and
  the contracts package can re-export the table for the UI.
- **Use the `opportunity.evidence_json` column to carry the analysis payload
  forward.** Rejected: the analysis already has the evidence; copying it forward
  duplicates data and breaks the source-of-truth invariant. The `analysis_id`
  FK is enough; the detail page links to the analysis.
- **Allow archive only from `delivered`.** Rejected: the auditor sometimes needs
  to archive a `draft` they don't intend to pursue, or an `in_progress` that
  turns out to be a duplicate. The "any state can be archived" rule is more
  forgiving and the audit trail captures the edge.
- **Re-open an archived opportunity.** Rejected (see above): the audit trail
  should show a new decision, not a reversal. M11.x can add a "duplicate" action
  if the need arises.
