# 0020 - Pseudonym erasure cascade and data-layer hardening

- Status: Accepted
- Date: 2026-10-17
- Related: [0016](0016-fr09-retention-export-deletion.md), [0003](0003-postgres-migrations-and-rls.md)

## Context

M15 deleted only `respondent_badges`. The same pseudonym's invitation, respondent, submission,
answers and analyses survived, so FR-09 was not met. The retention worker was an unscheduled
function. CSV exports of respondent free text allowed spreadsheet formula injection, `withTenant`
interpolated the tenant id into `SET LOCAL`, and `db.ts` fell back to a dev password.

## Decision

### Erasure inventory (every table reachable from a pseudonym)

| Table                                                         | Carries / derives from pseudonym             | Action                                                                                                                                                        |
| ------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invitations`                                                 | `respondent_pseudonym`                       | delete                                                                                                                                                        |
| `respondents`                                                 | `pseudonym`, via invitation                  | delete (FK cascade)                                                                                                                                           |
| `submissions`                                                 | via invitation (free text `end_comment`)     | delete (FK cascade)                                                                                                                                           |
| `answers`                                                     | via submission (free text)                   | delete (FK cascade)                                                                                                                                           |
| `analyses`                                                    | via submission (payload, evidence)           | delete                                                                                                                                                        |
| `respondent_badges`                                           | `respondent_pseudonym`                       | delete                                                                                                                                                        |
| `opportunities`                                               | `analysis_id` (text derived from analysis)   | draft: delete; reviewed (approved and later): keep, `analysis_id` nulled by FK. A human wrote and approved the content; it is no longer linkable to a person. |
| `synergies`                                                   | `source_analysis_ids` (cross-team aggregate) | keep; remove the erased analysis ids and recompute `occurrence_count`; delete when fewer than 2 sources remain (an aggregate needs at least 2)                |
| `team_badges`                                                 | aggregate per team, no pseudonym             | keep; recomputed by the rollup worker                                                                                                                         |
| `sponsor_briefs`, `export_requests`, templates, tenants, orgs | no pseudonym                                 | keep                                                                                                                                                          |
| `audit_log`                                                   | append-only (RLS blocks UPDATE/DELETE)       | keep; the erase writes a new `pseudonym.erase` row                                                                                                            |
| `deletion_events`                                             | append-only                                  | keep; one row per kind removed, with `row_count`                                                                                                              |

Rows written by M15 before this change may hold a raw pseudonym in `audit_log.payload_json` or
`deletion_events.respondent_pseudonym`; the append-only policies prevent rewriting them. Pilots
that ran that version must handle those rows by hand (owner decision, not automated here).

### One function, two callers

`erase_respondent_pseudonym(tenant, pseudonym, actor, scope)` (migration 0014, plpgsql, SECURITY
INVOKER) does the whole cascade in the caller's transaction. It raises the service-account flag
only for its own duration (DELETE policies are service-account only) and restores it on exit.
Every statement is filtered by the explicit tenant id, so the same pseudonym string in another
tenant is a different person and is untouched. `deletePseudonym` (web) and the retention worker
(`services/ai`) both call it. A SQL function was chosen over a TypeScript helper because the web
app and the worker are separate packages, and one definition inside the transaction cannot drift.

The append-only trails store `sha256(tenant_id || ':' || pseudonym)` (hex, 64 chars) in
`audit_log.payload_json.pseudonym_hash` and `deletion_events.respondent_pseudonym`, never the raw
value, so erasing does not itself leave the identifier behind. The hash lets an operator prove a
given pseudonym was erased. `deletion_events` gains `row_count`; its `target_kind` and the audit
`action` / `target_kind` checks are widened.

### Retention

A pseudonym is due when **all** its badges are past `retention_at`; then the full cascade runs
with scope `retention_expired` and a seeded system actor. `scripts/retention-run.ts` (`pnpm
retention:run`) is the schedule entry point; `docs/ops/retention-schedule.md` documents a systemd
timer, cron and a compose service.

### Hardening

- `withTenant` validates the UUID and uses `select set_config('app.tenant_id', $1, true)`;
  the service-account flag uses `set_config` too.
- `rowsToCsv` prefixes `'` to text cells starting with `= + - @` tab or CR. JavaScript numbers are
  passed through as numbers so `-5` stays `-5`.
- With `NODE_ENV=production`, `DATABASE_APP_PASSWORD` unset or equal to the dev default throws.
  `docker-compose.yml` requires `POSTGRES_PASSWORD` and `DATABASE_APP_PASSWORD` from the environment.

## Alternatives

- Soft-delete or anonymise answers in place: rejected, free text cannot be reliably anonymised.
- Keep `analyses` and strip identifiers: rejected, the payload is derived from the answers.
- TypeScript cascade duplicated per caller: rejected (drift).

## Consequences

- Erasing by retention removes a respondent's whole record, not only the badge.
- Synergy counts can drop after an erase; thin ones disappear.
- The seeded system user `00000000-0000-4000-8000-000000000000` exists in every database.
- Production migration 0014 is applied by the normal migration run; it is additive.
