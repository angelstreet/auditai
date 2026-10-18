# 0035 - Per-tenant redaction terms admin

- Status: Accepted
- Date: 2026-10-18
- Related: [0029](0029-llm-synthesis-provider-abstraction.md), [0016](0016-fr09-retention-export-deletion.md), [0030](0030-pseudonym-erasure-cascade.md), [0003](0003-postgres-migrations-and-rls.md)

## Context

The redactor in `services/ai/src/llm/redaction.ts` already replaces e-mails, phone
numbers, IBANs and long digit identifiers before any model call (TASK-H, ADR 0029).
It accepts a list of additional names per tenant from `ai_redaction_terms` and the
AI worker reads them in `services/ai/src/worker.ts:loadRedactionTerms`. The table
exists from migration 0016 with the standard four-policy RLS, but there was no
admin surface to add or remove terms. The Gate B checklist in
[docs/ROADMAP.md](../ROADMAP.md) names the admin UI as the last open piece before
the Gate B evidence is reviewable end-to-end.

Without the UI, the only way to add a name was a direct SQL `INSERT` on the live
database, which has no audit trail and no UI to confirm the change with the
respondent's data flow.

## Decision

1. **Admin route `/admin/redaction`.** Server component renders the list of
   current terms (oldest first), the add form, and a recent-changes panel driven
   from `audit_log`. The route is added to `AdminTabs` so it sits next to the
   other admin sections. The form is a React `useFormState` client island; the
   `redirectTo` path always points back to the same admin section so the tenant
   selector survives the round trip.
2. **Migration `0020_redaction_terms_audit.sql`** extends the `audit_log` CHECK
   constraints with two new verbs (`redaction_term.add`, `redaction_term.remove`)
   and one new `target_kind` (`redaction_term`). The data layer is the only
   writer, and it writes exactly one row per change with the row id as
   `target_id` and the term itself in the payload. Update / delete policies on
   `audit_log` remain unchanged.
3. **Data layer `apps/web/src/lib/redactionTermData.ts`.** Three functions:
   `listRedactionTerms`, `addRedactionTerm`, `removeRedactionTerm`. `add` is
   idempotent on `(tenant_id, term)` so re-adding the same name collapses to a
   single row and the audit log records the upsert only once. `remove` deletes
   by row id, never by term text — a rename leaves the trail intact.
4. **Contracts `packages/contracts/src/redactionTerm.ts`** mirror the data
   shape: `redactionTermSchema`, `redactionTermWriteSchema` (trims and
   lower-cases), `redactionTermRemoveSchema`. The `auditActionSchema` and
   `auditTargetKindSchema` are extended in `auditLog.ts` so the new verbs are
   first-class Zod enums; the contracts test pins the new values.
5. **The audit log is the trail of record.** The page renders the most recent 50
   `redaction_term.*` rows for the tenant so the auditor sees who added or
   removed which term and when. Removal of a term is by row id so the trail
   never gets orphaned.
6. **Smoke `apps/web/scripts/m16-smoke.mjs`** asserts: the page renders, an add
   is idempotent on re-add, the worker picks up the new term (`loadRedactionTerms`
   returns it), a remove deletes the row and writes a matching audit log row.

## Consequences

- Auditors can now own the per-tenant redaction list from the admin shell,
  without a database write. Every change is logged in the immutable audit log.
- The RLS on `ai_redaction_terms` is unchanged; it already matched the standard
  four-policy pattern, so tenant isolation was free.
- The `audit_log` CHECK constraints gain two verbs and one target kind. Any
  consumer that hard-codes the enum (e.g. an external compliance dashboard)
  needs to add the new values.
- Migration `0020` is forward-only. Deploys that already have migration `0019_view_as_audit`
  on production apply this next.
