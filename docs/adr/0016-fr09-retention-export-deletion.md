# 0016 - FR-09 retention + deletion + export (M15)

- Status: Accepted (slice A)
- Date: 2026-10-17
- Deciders: maintainers
- Related: [0003](0003-postgres-migrations-and-rls.md), [0008](0008-auditor-review.md), [0009](0009-opportunity-register.md), [0013](0013-quiz-badges-and-mascots.md), [0014](0014-quiz-form-and-result.md)

## Context

The audit-quality deliverables (M10, M11, M12, M13, M14) all rely on
the `audit_log` table as the source of truth and on `respondent_badges`
as the gamified layer's storage. PRD FR-09 names three explicit
deliverables that were not in any earlier slice:

1. **Team report export** — the analyst / sponsor can pull a CSV of
   `opportunities`, `analyses`, `respondent_badges`, `team_badges`,
   `synergies`, or `audit_log` for one tenant.
2. **Audit logs** — already in `main` (`audit_log` table, append-only
   via RLS). The FR-09 expectation is the _exportable_ surface.
3. **Deletion workflow** — a right-to-erasure flow per pseudonym and a
   retention-driven purge for the badge table.

This ADR covers **Slice A** of M15: the schema + data layer + worker,
no admin UI yet. Slice B will add the `/admin/data` page that exposes
them; Slice C adds the schedule + alerting (Phase 3).

## Decision

### 1. The schema (migrations `0012_export_and_deletion.sql` + `0013_export_audit_actions.sql`)

Two new tenant-scoped tables, both following the standard four-policy RLS
pattern. `deletion_events` is **append-only** — UPDATE / DELETE blocked
by RLS — so the trail is the source of truth (PRD §25.4).

```
export_requests(
  id, tenant_id, requested_by,
  kind ENUM {opportunities, analyses, respondent_badges, team_badges, synergies, audit_log},
  status ENUM {pending, completed, failed}, row_count >= 0,
  error TEXT, created_at, completed_at
)

deletion_events(
  id, tenant_id, requested_by,
  scope ENUM {respondent_pseudonym, retention_expired, engagement, tenant},
  respondent_pseudonym NULLABLE,
  target_kind ENUM {respondent_badge, synergy, opportunity, analysis, audit_log, export_request},
  target_id NULLABLE, audit_log_id NULLABLE, created_at
)
```

Migration `0013` extends the `audit_log.action` CHECK to accept the two
new verbs (`export.complete`, `badge.erase`) and adds
`respondent_badge` + `export_request` to the `target_kind` CHECK. The
M4 RLS posture + service-account flag is preserved.

### 2. The contracts

`@auditai/contracts` adds `export.ts` and `deletion.ts`:

- `exportKindSchema` (6 kinds), `exportStatusSchema`,
  `exportRequestSchema` + `exportRequestWriteSchema`.
- `deletionScopeSchema` (4 scopes), `deletionTargetKindSchema`
  (6 target kinds), `deletionEventSchema`,
  `deletionRequestSchema` (= the right-to-erasure input shape).
- `auditLog` gets the two new actions + the two new target kinds.

10 new tests, 8 in `auditLog.test.ts` updated, **120 contracts tests total**
(was 110).

### 3. The data layers

`apps/web/src/lib/exportData.ts`:

- `runExport(tenantId, kind, actorUserId)` writes the request row,
  counts + materialises the CSV in one transaction, flips the row to
  `completed` with the row count, returns the CSV string. On error,
  flips the row to `failed` with the message.
- `listExportRequests(tenantId)` orders by `created_at DESC`.
- `materialiseQuery` is per-kind: each kind maps to a tenant-scoped
  read with the right columns. CSVs are escaped per RFC 4180.

`apps/web/src/lib/deletionData.ts`:

- `deletePseudonym(tenantId, pseudonym, actorUserId)` iterates the
  pseudonym's respondent_badges rows, inserts an `audit_log` row +
  a `deletion_events` row per badge, deletes the badges, returns the
  count + the events list. All four operations run in one transaction
  so partial failures leave no loose ends.
- `listDeletionEvents(tenantId)` orders by `created_at DESC`.

### 4. The retention worker

`services/ai/src/retentionWorker.ts` exposes `runRetentionWorker()`:

- For each tenant, finds `respondent_badges` rows whose `retention_at`
  is in the past, writes an `audit_log` row (`badge.erase`), a
  `deletion_events` row (scope `retention_expired`), and deletes the
  badge. The whole per-tenant loop is transaction-scoped; on error the
  partial writes are rolled back.
- The system actor (`00000000-...-0000`) is recorded so the audit
  trail is reconstructable.
- Idempotent: re-running after a fully-purged tenant prints `purged=0`.

### 5. The smoke

`apps/web/scripts/m15-smoke.mjs`:

1. Seeds 3 pseudonyms: 1 with `retention_at` in the past, 2 fresh.
2. Spawns `pnpm --filter @auditai/ai run retention-smoke`; asserts
   `purged >= 1`, the expired row is gone, the fresh rows survive.
3. Asserts `deletion_events` writes a row with `scope='retention_expired'`
   - an `audit_log` row with `action='badge.erase'`.
4. Mirrors `deletePseudonym` for a third pseudonym; asserts the badge
   is gone, a `deletion_events` row with `scope='respondent_pseudonym'`
   is written, and an `audit_log` row carries the pseudonym in
   `payload_json`.
5. Mirrors `runExport('opportunities')`; asserts `export_requests` has
   one new row with `row_count >= 1` and the audit_log row carries
   `action='export.complete'`.
6. Cleans up so subsequent runs are idempotent.

### 6. What's NOT in Slice A

- `/admin/data` page that exposes the export + delete actions in the
  UI. Slice B.
- A scheduled cron for `runRetentionWorker`. Phase 3 — today the
  worker is invoked via CLI / smoke / ops job.
- An audit_log visualisation page. Slice B can aggregate the existing
  per-target audit trail into a single page.

## Consequences

- The export endpoint is live today and tested end-to-end. The next
  surface to add is the analyst page that triggers it.
- The right-to-erasure flow is logged + audited. Future PRs can add
  per-engagement + per-tenant wipe with the same data layer.
- The retention worker is runnable today; an ops job (Phase 3) can
  schedule it. The data layer is idempotent, so re-runs are safe.
- The audit-log CHECK constraint is now wider. Existing `audit_log`
  rows are unaffected; only new rows need the new verbs.

## Alternatives considered

- **External blob storage for the CSV.** Rejected for the pilot: the
  analyst pulls ad-hoc; storing exports in S3 / GCS adds a dependency
  for marginal value. The `export_requests.row_count` + the in-line
  return is enough for the pilot. Slice B can wire a download URL.
- **Make the retention worker run on the request that creates the
  badge (push).** Rejected: pull is simpler, idempotent, and matches
  the rest of the worker pattern (M9, M13).
- **Hard delete `synergies` + `opportunities` on pseudonym erase.**
  Rejected: those rows carry engagement-level signal; pseudonym erase
  should not touch them. The deletion trail makes the scope explicit.
- **Single `audit_log.action = 'erase'` for both pseudonyms + retention.**
  Rejected: the audit verb should distinguish intent. The
  `payload_json` carries the pseudonym; the `action` carries the
  trigger (`'badge.erase'` for both, with `scope` in the payload).
- **GDPR right-to-erasure across `audit_log` rows.** Deferred: the
  audit trail is append-only and the pseudonym is already only present
  in `payload_json`, which is the minimum disclosure. Re-encrypting or
  re-keying `audit_log` is a Phase 3 concern.
