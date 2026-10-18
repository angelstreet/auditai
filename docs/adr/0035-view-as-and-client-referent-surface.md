# 0035 - "View as" for the platform owner, and the team referent surface

- Status: Accepted
- Date: 2026-10-18
- Related: [0023](0023-auditor-auth-and-session.md), [0032](0032-production-readiness.md), [0033](0033-invitations-tracking-reminders.md), [0034](0034-mui-theme-and-standard-chrome.md)

## Context

During the pilot the owner (platform owner and auditor) must test both experiences: their own auditing view and
the client's view, without signing out. The first client has a team referent. PRD §4.3 and §15: a team referent
coordinates preparation, invites employees, sees completion counts and reminders, and **never** sees individual
answers or individual maturity results. Until now only staff (auditor, platform owner) could sign in, and every
admin page, action and API took its tenants from the signed session (ADR 0023).

"View as" is impersonation. Impersonation features are a classic source of privilege escalation, so the threat
model comes first.

## Threat model

| Threat                                                             | Control                                                                                                                                                                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A non-owner sets `viewAs` by editing the cookie                    | `viewAs` lives inside the HMAC-signed session payload; any edit breaks the signature.                                                                                                                               |
| A correctly signed cookie carries a `viewAs` its user may not hold | `verifySession` re-validates `viewAs` on every request: well-formed, a client role, and the same session holds `platform_owner` on that tenant. Otherwise the whole session is rejected.                            |
| A non-owner posts a persona id (forged form field, direct POST)    | `POST /api/view-as` refuses unless the session holds `platform_owner`; the persona is re-read from the database by membership id **and** restricted to the tenants the session owns. Form values are never trusted. |
| Nested or chained impersonation                                    | Refused: a session already viewing as cannot start another; a referent never can.                                                                                                                                   |
| Writes while impersonating (data created "as" the client)          | Read only. `resolveActor` (every admin server action) refuses first; the staff tenant list is empty, so admin APIs return 403 and admin pages redirect; public writes (intake, quiz, survey answer) refuse too.     |
| Side effects of looking (emails, reminders consumed)               | No view-as page sends email or changes state. Exports are reads, audited like the admin export.                                                                                                                     |
| Repudiation ("who did that?")                                      | Every step is trailed with the **real** actor: `view_as.start`, `view_as.stop`, `view_as.request` (one per page or route, path only, no query string), `view_as.refused`. The persona is the target.                |
| Session outlives its purpose                                       | The re-signed cookie keeps the original `iat`/`exp` and remaining max-age: a view-as ends with the sign-in. "Back to my view" clears it.                                                                            |
| Cross-site request starts a view-as                                | SameSite=Lax cookie, POST only, and `Sec-Fetch-Site: cross-site` is refused.                                                                                                                                        |
| The owner forgets they are impersonating                           | Sticky one-line banner under the header on every page, avatar shows the persona's initials, the organisation is stated above the page.                                                                              |
| The referent surface leaks individual data                         | Counts with the minimum group of 5, links without completion status, results only from approved analyses (themes raised by at least 5 people, label only) and published opportunities (title and status).           |
| Guessing ids of another tenant or team                             | The team space takes tenant and teams from the session only (no id in its URLs); every query runs under `withTenant` (RLS) and filters by the session's teams.                                                      |

## Decision

1. **Session.** `SessionPayload.viewAs?: { role, tenantId, teamId, personaId, label, tenantLabel, teamLabel }`,
   signed and validated as above. `SessionTenant` gains an optional `teamId` for team-scoped client memberships;
   sign-in now loads `team_referent` memberships with their team.
2. **Effective context, server side only.** `effectiveContext(session)` returns `staff`, `client` (real referent:
   may act; owner viewing as: read only) or `none`. Staff surfaces call `sessionTenantIds()` / `resolveActor()`,
   which redirect or refuse in a client context. The UI hiding links is not the guard.
3. **Switching.** `POST /api/view-as` with `persona=<membership id>` or `persona=self`. The account menu shows a
   "View as" section to platform owners only: "Me: auditor" and one entry per client persona of the tenants they own.
4. **Team space** `/client` (home, invitations, results), its own three-tab navigation, no organisation switcher.
   Real referents sign in and land there; their accounts are created without a password until the owner gives them one.
5. **First client seed** `pnpm seed:client`: idempotent, flags only (no client name in the repository), safe on the
   live database, never a migration. The owner gets `auditor` and `platform_owner` on the new tenant; the referent
   persona gets a `.invalid` address and no password.
6. **Migration 0019** only widens the audit verbs (`view_as.*`, `client.seed`, `user.set_email`). Forward only.

## Alternatives considered

- **A second, separate impersonation cookie.** Two cookies can drift (one expires, one not) and the server would
  have to cross-check them. One signed payload is simpler and cannot be half-valid.
- **Server-side impersonation table.** Revocable at once, but a new table, a lookup per request and more
  failure modes, for a dev-phase tool used by one person. The signed cookie expires with the sign-in.
- **A "preview" rendering of client pages inside admin.** Would not exercise the real referent code path, which is
  what the owner wants to test.
- **Write-enabled view-as.** Rejected: anything the owner does must be attributable to the owner, not to the client.

## Consequences

- Platform owner is now a real role in practice: it unlocks "View as" on the tenants where it is held.
- A referent persona exists as a user without a password. To give them a real login: `pnpm auditor:set-email`
  then `pnpm auditor:set-password` (RUNBOOK).
- `x-evolai-path` is set by the middleware for the trail; it is overwritten on every matched request so the
  client cannot forge it.
- Every view-as page view writes one audit row. Fine for a dev-phase tool; revisit if view-as is used at scale.
