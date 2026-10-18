# 0033 - Invitations, response tracking and reminders (FR-03)

- Status: Accepted
- Date: 2026-10-18
- Related: [0004](0004-mobile-web-survey-stack.md), [0016](0016-fr09-retention-export-deletion.md), [0030](0030-pseudonym-erasure-cascade.md), [0032](0032-production-readiness.md)

## Context

An invitation was a single-use signed link with an expiry, but there was no way for an auditor to create them in
bulk, see who had answered, or remind people. The privacy rules (PRD §15, §25.1) are acceptance criteria: the
auditor and the client never see who gave which answer, managers see aggregates only, respondents are pseudonymous.
The client's HR distributes the links, so by default the platform must not know a single name or address.

## Decision

1. **Default mode stores no personal data.** An admin (platform owner or auditor, tenant taken from the session)
   creates N invitations per team of an engagement. Each row has a random pseudonym (`p-` plus 16 hex), a random
   token reference and the existing HMAC signature, an expiry of 1 to 90 days (default 14), and nothing else about a
   person. Output: a CSV `link,team` and a printable QR sheet. The CSV neutralises spreadsheet formulas. Batches are
   capped at 2000 rows.
2. **Optional email delivery, per engagement, off by default** (`privacy_json.emailDelivery`). Behind an
   `EmailProvider` interface: a mock for tests and CI (refused when `NODE_ENV=production`) and one real adapter for
   Brevo (French company, EU hosting), configured only by `EMAIL_PROVIDER`, `BREVO_API_KEY`, `EMAIL_FROM`. Without
   configuration, creation with addresses fails before anything is written. Messages are plain text, with no
   tracking pixel and no per-recipient link other than the survey link.
3. **Address handling.** The address is encrypted with AES-256-GCM (`INVITE_EMAIL_KEY`, 32 bytes, bound to the
   invitation id as additional data) into `invitation_deliveries`, a table readable and writable only by the
   service-account role (RLS), so no tenant-scoped session, export or report can reach it. The cleartext exists only
   in memory for one send. It is deleted on completion (`submitState`), on revoke, on expiry, when `purge_after`
   passes (expiry plus one day), by the daily cron, and by the pseudonym erasure cascade (foreign key). Only counts
   are written to the audit trail.
4. **Response tracking** is computed from `invitations` alone: invited, opened, started, completed, completion rate
   and the last activity **day**. Status moves `pending` to `opened` when the link is first loaded, to `in_progress`
   at the first answer, to `submitted` at completion. A team with fewer than 5 invitations shows only "fewer than 5".
   Engagement totals are hidden when exactly one team is suppressed, because subtraction would reveal it. No query
   joins an invitation to a submission or an answer.
5. **Reminders.** A per-engagement schedule (default 3 and 7 days after creation, 1 to 5 increasing steps). Only
   not-completed, not-revoked, not-expired invitations, one step at a time; a step is consumed when it is recorded, so
   a run is idempotent. The cron route `/api/cron/reminders` (same `CRON_SECRET` bearer check as retention) sends
   through the provider in email mode, at most 200 per engagement per run, and writes one audit row with counts. In
   default mode it only counts; the admin screen shows the reminder list (links, no identity) and "mark as resent"
   consumes the step.
6. **Revoke, extend, regenerate.** Revoke is final and removes any stored address. Extend adds days and revives an
   expired link. Regenerate replaces the token reference, so the old link answers 404 at once.
7. **Exposure.** Everything is behind the admin session and role. The only per-invitation listing is the set of
   links not yet completed, with a six-character code and the team name, no status. Each admin operation writes an
   `audit_log` row (`invitation.*`, counts and ids only, never an address or a link).

## Privacy analysis of email mode

Linking an address to an answer would defeat anonymity. The address lives in a separate, service-only table keyed by
invitation id, while a submission is keyed by the same invitation id, so a database administrator with full access
could in principle join them while the address still exists. Mitigations: the address is deleted at completion (the
moment an answer becomes final), the window is bounded by the expiry, no application code path or export reads both,
and a DB test asserts no other table has an address column. The remaining risk is a privileged insider during the
window; the client must be told this before switching the setting on, and the setting stays off by default.
A stricter design (reminding only people who never opened the link) would shorten the window further; it was not
chosen because it fails the common case of someone who started and stopped.

## Alternatives considered

- **Store hashed addresses.** Cannot send mail from a hash.
- **Send through the client's own mail system only.** That is the default mode; email mode exists for clients who
  want the platform to send.
- **Join progress to answers for richer analytics.** Rejected: breaks the anonymity rule.

## Consequences

- Migration 0018 is additive (columns, one table, audit constraints). The previous build keeps running after it.
  It must be applied to Neon before the code that reads the new columns is deployed.
- New env vars, all optional: `APP_BASE_URL`, `INVITE_EMAIL_KEY`, `EMAIL_PROVIDER`, `BREVO_API_KEY`, `EMAIL_FROM`.
- The Brevo adapter is unit-tested against a stubbed `fetch` only; it has not been run against the live service.
- A second Vercel cron (`/api/cron/reminders`, daily 07:43 UTC).
- Dependency: `qrcode` for the printable QR sheet.
