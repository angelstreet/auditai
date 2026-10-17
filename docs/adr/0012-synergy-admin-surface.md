# 0012 - Cross-team synergy admin surface (M13 slice C)

- Status: Accepted
- Date: 2026-10-17
- Deciders: maintainers
- Related: [0008](0008-auditor-review.md), [0009](0009-opportunity-register.md), [0011](0011-cross-team-synergy.md)

## Context

Slice A put the `synergies` table in place; slice B wired the cross-team
detector that fills it. The remaining gap for FR-14 is the human surface:
a list of detected recurrences the consultant can scan, transition, and
audit. The auditor already has reading surfaces (`/admin/engagements`,
`/admin/engagements/[id]/analyses`) and workflow surfaces for analyses +
opportunities (M10, M11), so the synergy admin lives in the same place.

## Decision

### 1. The URL is `/admin/synergies`

The route sits next to the existing admin pages, scoped to one tenant
via `?tenant=<uuid>`. We deliberately do **not** make it
`/admin/engagements/[id]/synergies`: a synergy by construction spans

> = 2 engagements, so its home is the tenant, not any one engagement.

### 2. The contracts

Two new exports in `@auditai/contracts`:

- `synergyStatusTransitionSchema` — Zod-refined schema that only accepts
  the transitions in the graph below. Mirrors `opportunityStatusTransitionSchema`.
- Three new audit actions (`synergy.surface`, `synergy.dismiss`,
  `synergy.archive`) in `auditActionSchema`, with two new tests in
  `synergy.test.ts` (one for allowed moves, one for rejected moves).

The graph:

```
detected  ──> surfaced  ──> archived
   │            │
   └──> dismissed ──> archived

archived is terminal; a re-opening is a new row.
```

### 3. The data layer

`apps/web/src/lib/synergyData.ts` exposes:

- `listSynergies(tenantId)`: every row in the tenant, ordered by
  `detected_at DESC`. Runs under `withTenant` so RLS gates the read.
- `transitionSynergy(tenantId, synergyId, nextStatus, actorUserId)`:
  reads the current row, parses the transition through
  `synergyStatusTransitionSchema`, issues the UPDATE, and writes one
  matching `audit_log` row (`synergy.surface|surface|dismiss|archive`).
  Everything runs in one transaction, so partial failures leave no
  loose ends.

### 4. The page

`apps/web/src/app/admin/synergies/page.tsx` is a server component that:

- Resolves the actor tenant from `?tenant=<uuid>` (fallback to the
  first synthetic tenant).
- Pulls every synergy in the tenant and renders one card per row.
- Renders a status pill with one of four tones
  (detected / surfaced / dismissed / archived).
- Embeds the client-side `TransitionSynergyForm` for non-terminal rows.

### 5. The migration `0010_synergy_transition_audit.sql`

Extends the `audit_log.action` CHECK to include the three new
synergy verbs. Forward-only; no data rewrite.

### 6. The smoke

The existing `apps/web/scripts/m13-smoke.mjs` is extended in place so
the slice-B + slice-C walk is a single assertion chain:

- After the existing worker + idempotency assertions, the smoke now
  GETs `/admin/synergies?tenant=<uuid>` and asserts the synergy
  theme + status pill render.
- Transitions `detected → surfaced` via SQL that mirrors the server
  action (UPDATE + INSERT audit_log) and re-asserts the pill flips.
- Transitions `surfaced → archived` and asserts 2 transition audit_log
  rows exist.
- Confirms the contract-level guard rejects `surfaced → detected` (and
  any other illegal move) so the data layer never silently accepts a
  bad transition.

## Consequences

- The audit log captures every human move on a synergy. The trail is
  append-only; corrections are new rows.
- The status graph makes a misclick reversible (surface <-> dismissed)
  while keeping `archived` terminal and explicit.
- The page is read-heavy: every read goes through the same RLS path the
  rest of the admin uses, with no special server-only routes.
- The `/board` route from M12 does not change in this slice; synergies
  remain a dedicated `/admin/synergies` route so the board stays
  portfolio-level and the admin surface stays targeted.

## Alternatives considered

- **Read synergies directly from `/board`.** Rejected for clarity: the
  board is portfolio-level signal (counts, status pills, brief cards),
  while the synergies page is the analyst's working surface. Keeping
  them separate makes both easier to read.
- **One transition audit row per actor action (no per-day dedupe).**
  Accepted: the trail is the source of truth. Dedupes would hide audit
  bias that's worth surfacing.
- **Hard delete on archive.** Rejected: archived rows are still useful
  for retrospective analyses ("which themes did we surface 6 months
  ago") and the audit trail stays complete.
- **Auto-archive after 90 days.** Deferred: the retention policy is a
  tenant-level concern (PRD §15), not a per-synergy one. Future M13.x
  cleanup worker can fold into that.
