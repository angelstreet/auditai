# 0040 - Referent login by link, complete privacy notice, audit-trail screen, data-page safety

- Status: Accepted
- Date: 2026-10-19
- Related: [0023](0023-auditor-auth-and-session.md), [0030](0030-pseudonym-erasure-cascade.md), [0032](0032-production-readiness.md), [0033](0033-invitations-tracking-reminders.md), [0035](0035-view-as-and-client-referent-surface.md), [0038](0038-audit-setup-organisation-context-and-language.md); readiness items 1, 2, 12, 13 in [AUDIT_WORKFLOW](../AUDIT_WORKFLOW.md) and [TEST_FEEDBACK_2026-10-19](../TEST_FEEDBACK_2026-10-19.md)

## Context

A referent persona had a placeholder address and no password, so the first real client contact could only be given
a login by a command line on the owner's machine. The privacy page was two generic paragraphs: no controller, no
contact, no retention, no sub-processors, and no way to withdraw without asking a manager. The audit trail existed
in the database but nobody could read it. Erasing an unknown code looked like a success in the first review, and the
auditor could not find a code without asking the team. A team mascot could show for two people, which identifies
them.

## Decision

1. **Login by link, no stored address.** The owner types the referent's address once on `/admin/teams` ("Create
   sign-in link"). The address replaces `users.email_hash` (SHA-256, the same lookup as every sign-in) and is held in
   memory only to send an email when the provider interface is configured; otherwise the owner copies the link.
   Nothing is encrypted or stored beyond the hash, so there is nothing to purge (ADR 0033 and 0035 patterns
   unchanged). Only a `team_referent` of the organisation being worked on can be invited, checked against
   `memberships.tenant_id`.
2. **Tokens.** `auth_tokens` (migration 0022) holds `sha256(token)`, never the token: 32 random bytes, shown once.
   A token is spent by one atomic `UPDATE ... WHERE used_at IS NULL AND expires_at > now`, so two parallel requests
   cannot both win; issuing a new one spends the older open ones; a disabled account is refused. An owner link lives
   72 hours (it is sent by hand), a self-service reset 60 minutes. A weak or mistyped password is rejected before the
   token is spent. The password rule is length only: 12 to 256 characters.
3. **Pages.** `/set-password?token=` (plain words, the rule up front, show/hide eye, success signs in and goes to
   `/client` for a referent, `/board` for staff) and `/forgot-password` (same answer for every address, including
   rate-limited and disabled ones). The login page links to it. The set-password page sends `Referrer-Policy:
no-referrer` and is not indexed.
4. **Rate limits** for public forms use `public_attempts` (hashed keys, counted in Postgres like the login lockout,
   ADR 0032): forgot password 3 per address and 10 per network address per hour; privacy request 5 and 10.
   Every call is counted, known address or not, and an over-limit call returns the normal answer.
5. **Privacy notice per engagement.** Fields live in `engagements.privacy_json.notice` (no new column): controller,
   privacy contact (name or role, email), purpose, legal basis (consent or legitimate interest), service providers,
   hosting region, and whether AI analysis is on with the approved service. Retention comes from the organisation's
   `retention_days`. Defaults are safe (controller is the organisation, basis is consent, standard purpose text).
   `/privacy?e=<engagement>` shows the fixed parts (what is and is not collected, who sees what, rights) and the
   configured parts; a part that is not configured is hidden, never an empty placeholder, with one line saying who to
   ask. The AI section needs both the switch and a named service (fail closed). The admin settings page edits the
   fields and lists "Not configured yet". The first survey page shows who is asking, the purpose and the time from
   the same resolved fields. The public read returns only these fields.
6. **Request to withdraw or erase** without a manager: a plain form on the public page writes one `privacy_requests`
   row for the engagement's organisation (migration 0022; no name; optional reply address, cleared when handled).
   The auditor sees it on `/admin/data` and marks it handled (audited). The privacy contact gets a content-free email
   when a provider is configured. Public writes go through the service account behind the rate limit.
7. **Audit-trail screen** `/admin/audit` and a CSV: date, who, what in plain words (one label per action in both
   languages; a test fails if a new action has no label), filter by group and date. The payload is never read, shown
   or exported, so no token, address or text can leak. `view_as.request` (one row per page) is left out of
   "Everything" and shown in its own group. New verbs: `referent.invite`, `password.set`, `password.reset`,
   `password.reset_request`, `privacy.update`, `privacy_request.handle`.
8. **Data-page safety.** The erase button first counts what will go (links, completed surveys, answers, mascots)
   and shows it in the confirmation, which still needs the code typed; an unknown code is said plainly before any
   dialog. The auditor can find a code by batch of links or by date; only codes, team, status and date are returned,
   never an address. The export keeps its download button and plain column names.
9. **Small-group guard.** A team mascot and any per-team result need at least `MIN_GROUP_SIZE` (5) completed
   answers. It is enforced where the data is read (`listTeamBadges` filters in SQL, the respondent status query, the
   team export), so no page can forget it; the teams page says once "Hidden under 5 people to protect privacy".

## Alternatives

- **Store the referent address encrypted** so reset emails need no typing: rejected. A reset request carries the
  address the person types, and the owner types it at invite time, so nothing needs storing. Less data, no key.
- **Magic-link sign-in without a password**: rejected for now; a password plus a reset link matches the existing
  login, lockout and session code, and is one step towards SSO and MFA (still open).
- **Per-engagement notice table**: rejected; `privacy_json` already carries the engagement's privacy settings and
  needs no join.
- **Email the owner's link by default**: rejected; delivery stays optional behind the provider interface.
- **Show small groups with a warning** instead of hiding them: rejected; two people's mascot identifies them.

## Consequences

- Migration `0022_referent_login_privacy_requests.sql` (forward only): `auth_tokens`, `public_attempts`,
  `privacy_requests`, six audit verbs and the `privacy_request` target. The live database needs it before deploy.
- Without an email provider, "forgot password" cannot deliver anything; the owner creates a new link by hand
  (RUNBOOK). The page says so in the same neutral words.
- A privacy request is not an erasure: the auditor still runs the erase action after checking who is asking.
- The audit CSV of the trail itself is not yet recorded as an export; the screen is read only.
- Reset and invite links are bearer secrets for their lifetime; they are shown once, hashed at rest and spent on use.
