# 0044 - Email-only identity: no personal name for accounts

- Status: Accepted
- Date: 2026-10-20
- Related: [0032](0032-production-readiness.md), [0035](0035-view-as-and-client-referent-surface.md), [0040](0040-referent-login-privacy-notice-audit-trail.md), TASK-X

## Context

Employees are already anonymous (a respondent code). Staff and referent accounts still carried a first and last
name: asked by `auditor:create` and `seed:client`, stored in `users.display_name`, shown in the header, the
"View as" banner, the audit trail and the referent list, and used as the contact in the invitation message. The
owner decided to anonymise the whole process: an account is an email address and a role, nothing else.

Only `email_hash` was stored, so an address could not be shown as a label.

## Decision

- No command or form asks for a person name. `auditor:create` drops `--name`; `seed:client` drops
  `--referent-name` and creates the referent persona as `referent-1@<client-slug>.invalid` (or the given
  `--referent-email`). The engagement contact is an email address or a role; with none set, messages say
  "your team referent" / "votre référent d'équipe".
- Migration 0025: `users.display_name` becomes nullable and is no longer written (not dropped yet); new nullable
  `users.email` holds the sign-in address in clear, filled when an account is created, when its address is set and
  at sign-in. `email_hash` stays the lookup key.
- One helper (`apps/web/src/lib/identityLabel.ts`) labels every user from the local part of the address,
  truncated, with initials from it; null or empty falls back to the role label. Used by the header, the view-as
  banner and persona list, the audit trail, the referent list and the redaction history.
- `pnpm identity:strip-names` (dry run by default, `--apply`) nulls existing display names and rewrites
  placeholder referent addresses derived from a name to `referent-<n>@<slug>.invalid`. Idempotent, audit-logged
  with the existing `user.set_email` verb, prints counts only.

## Alternatives

- Show only the role: loses the ability to tell two referents or two auditors apart in the trail.
- Keep hashes only and show a short hash: unreadable and not obviously "an email".
- Drop `display_name` now: irreversible on the live database; deferred to a later forward migration.

## Consequences

- A clear-text address of staff and referents is stored, which is personal data, but it is the sign-in identifier
  and the owner's chosen identity. Employees have no `users` row, so nothing changes for them.
- The address is visible in the account menu and, as a local part, in the trail and the view-as banner.
- Sessions issued before the change carry an old name; the header ignores it and uses the address.
- Migration to apply on the live database: `0025_users_email_only.sql`, then `pnpm identity:strip-names --apply`.
