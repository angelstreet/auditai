# 0008 - Auditor review page, human-approval gate, and the audit log (M10)

- Status: Accepted
- Date: 2026-10-15
- Deciders: maintainers
- Related: [0001](0001-license-and-stack.md), [0003](0003-rls-and-tenant-isolation.md), [0004](0004-mobile-survey-and-admin.md), [0005](0005-admin-data.md), [0006](0006-local-dev-runner.md), [0007](0007-ai-pipeline.md)

## Context

M9 (`/docs/adr/0007-ai-pipeline.md`) ships a rule-based AI worker that writes one
`analyses` row per submitted survey. The worker stores:

- a denormalised `sensitivity` / `theme_count` / `prompt_count` for fast UI filtering;
- a `payload_json` with the full `AnalysisPayload` (themes, contradictions, interview prompts);
- an `evidence_json` with the flat list of `{claim, sourceKind, sourceId, quote}` records;
- a `model_route` so the auditor knows which model produced the row;
- a nullable `approved_at` + `approved_by` — the human-approval gate from PRD §10.

M9 is deliberately a write-only pipeline: it never reads `approved_at`, never blocks writes
on it, and never publishes anything. The M10 deliverable is the read side: a web page that
lets the auditor open an analysis, see every claim with its source, and approve (or
reject) it. Every approval writes a row to a new append-only `audit_log` so the trail
satisfies PRD §25.4 and is the basis for the Gate A audit-log evidence.

M10 also pre-creates an `opportunities` table so M11+ can wire the publish action without
another migration. M10 does **not** write opportunities; only the table + RLS land here.

## Decision

### 1. Two new tables (migration `0006_audit_log_and_opportunities.sql`)

```
audit_log(
  id, tenant_id, actor_user_id, action, target_kind, target_id,
  payload_json, created_at
)

opportunities(
  id, tenant_id, engagement_id, analysis_id NULLABLE, status,
  title, description, axis NULLABLE, impact_score NULLABLE,
  owner_user_id NULLABLE, created_by, created_at, updated_at, archived_at NULLABLE
)
```

- `audit_log` is **append-only** by RLS: SELECT / INSERT permitted, UPDATE / DELETE blocked
  (`USING (FALSE) WITH CHECK (FALSE)`). Corrections are a new row that points at the same
  target with a `payload_json` describing the change.
- `action` is a CHECK constraint matching the Zod enum: `analysis.approve`,
  `analysis.reject`, `opportunity.create`, `opportunity.update`, `opportunity.archive`.
  Future actions (`badge.award` for M14, `opportunity.publish` for M11, etc.) require a
  migration that adds them to the CHECK and to the Zod enum.
- `opportunities.analysis_id` is **nullable** so a hand-drafted opportunity can exist
  before it is linked back to an AI output. M11+ adds the "must-link before approval" rule
  and the status transitions.
- `opportunities.status` carries the workflow states for M11+ (`draft` / `approved` /
  `in_progress` / `delivered` / `archived`). M10 only writes `draft`.
- A synthetic auditor `users` row + `memberships` row per tenant is seeded so the smoke
  can pick a real UUID for the `actor_user_id` foreign key.

### 2. The web app surface

```
apps/web/src/
  lib/auditorData.ts
    listAnalysesForEngagement(tenantId, engagementId)
    getAnalysis(tenantId, analysisId)
    approveAnalysis(tenantId, analysisId, actorUserId, payload)
    listAuditLogForTarget(tenantId, targetKind, targetId, limit)
    findAuditorForTenant(tenantId)
    engagementLabelFor(tenantId, engagementId)
  app/admin/engagements/[id]/analyses/page.tsx
  app/admin/engagements/[id]/analyses/[analysisId]/page.tsx
  app/admin/engagements/[id]/analyses/[analysisId]/ApproveForm.tsx
  app/admin/engagements/[id]/analyses/[analysisId]/actions.ts
```

- The list page renders the per-engagement analyses with sensitivity, theme / prompt counts,
  model route, submitted / approved timestamps, and a per-row link to the detail page.
- The detail page renders the analysis in four sections: **Themes** (with axis + evidence
  count), **Contradictions**, **Interview prompts**, and **Evidence** (the flat
  `{claim, sourceKind, sourceId, quote}` table). The evidence section is the auditor's
  verification step before approval.
- The detail page also renders the **Audit trail** at the bottom, listing every audit
  log row for the analysis (in reverse-chronological order). M11+ will surface the same
  list on the engagement and opportunity detail pages.

### 3. The server action

The form posts to a Next.js server action (`approveAnalysisAction`) that:

1. Validates the form payloads (tenant id + analysis id are UUIDs).
2. Resolves the actor: prefers an `x-audit-actor-id` header (set by tests / staging), falls
   back to the first `auditor` membership of the tenant. Production replaces this with the
   authenticated session user once Gate C (SSO + MFA) lands.
3. Calls `approveAnalysis(tenantId, analysisId, actorUserId, payload)`, which runs the
   `UPDATE analyses SET approved_at = now() ...` and the `INSERT INTO audit_log` in the
   same per-tenant transaction. RLS gates both writes to the actor's tenant.
4. Revalidates the cached page (`revalidatePath`) so the next render shows the
   "Approved at" line instead of the form.

The action does **not** write an opportunity. M11+ will add a separate "create opportunity
from analysis" flow that the auditor can run after approval.

### 4. Evidence contract honoured end-to-end

PRD §10 (FR-12) requires that every claim link back to a source row. M9 wrote the evidence
contract; M10 is the first surface that surfaces it to a human. The detail page renders the
flat `evidence_json` list as a table with `claim / source / quote` columns. The auditor's
job is to click through to the source row (the `sourceId`) and verify the quote before
approving. The detail page does not link to the source row in M10 (the row is in the same
database but the survey submission detail page is not built yet); M11+ adds the link.

### 5. Auth deferred to Gate C (M14+)

The server action trusts the synthetic auditor. In production:

- The action will require an authenticated session (NextAuth / Clerk / Ory / etc.).
- The session user must have an `auditor` membership in the tenant.
- The `actor_user_id` on the `audit_log` row is the session user, not the membership's
  user (a real user can be a member of many tenants).

M10 ships the data shape, the RLS, the action signature, and the smoke; the auth layer
is a Gate C deliverable. Until then, the M10 server action falls back to the synthetic
auditor so the smoke can drive it.

### 6. Service-account boundary (PRD §25.1)

Reads (`listAnalysesForEngagement`, `getAnalysis`, `engagementLabelFor`) run in
`withTenant(tenantId, ...)` so the RLS policy that filters by `app.tenant_id` is in
effect. Writes (`approveAnalysis`) also run in `withTenant` because the action takes the
tenant id from the form. The synthetic seed inserts the auditor user + membership with
`role = 'auditor'` so the data layer can find the actor.

The detail page uses `withServiceAccount` for nothing (we never read across tenants on
this surface). The cross-tenant deny tests from M4 still pass; M11+ adds an explicit
"tenant B cannot see tenant A's audit_log rows" test.

## Consequences

- The first human-facing surface for the M9 AI output is in place. The auditor can open
  a survey, see the analysis, and approve with a rationale that lands in the audit log.
- Every approval is traceable: who, when, which analysis, which model route, which
  rationale. The trail is append-only by RLS so it is tamper-evident from inside the app
  (the table owner is `auditai_app` which is `NOSUPERUSER NOBYPASSRLS`).
- M10 keeps the LLM swap as a contained change: the worker's API (the
  `analyses.payload_json` shape + the `evidence_json` list) is the contract. An LLM
  implementation writes the same shape; the detail page renders the same view.
- The opportunity register table is created but unused in M10. M11 lands the CRUD,
  the publish action, and the status transitions.
- The auth layer is still missing; the action falls back to the synthetic auditor. Gate C
  (M14+ on the original plan, or a dedicated milestone) replaces the fallback with the
  real session check.

## Alternatives considered

- **Render the evidence with clickable links to the source row.** Rejected for M10: the
  survey submission detail page is not built yet, and a broken link would mislead the
  auditor. M11+ adds the link alongside the publish flow.
- **Hard-delete the analysis on reject.** Rejected: PRD §10 says corrections are a new
  row, and the audit log already covers the trail. A `rejected_at` column on `analyses`
  is the alternative if rejection ever needs to gate the worker; not in M10.
- **Use a single `auditor_actions` table for both approve and reject.** Rejected: the
  log already covers both via the `action` column, and two tables would force the same
  read pattern twice.
- **Store the opportunity directly from the approval form.** Rejected: it would couple
  approval to opportunity creation, force every approval to spawn an opportunity, and
  bypass the M11+ "must-link-before-approval" rule. M11+ wires the publish action
  separately.
