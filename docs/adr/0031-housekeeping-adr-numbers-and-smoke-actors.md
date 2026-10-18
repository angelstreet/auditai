# 0031 - Housekeeping: ADR number check, owner in CODEOWNERS, smoke actors from a session

- Status: Accepted
- Date: 2026-10-18
- Related: [0023](0023-auditor-auth-and-session.md), [0030](0030-pseudonym-erasure-cascade.md), [0026](0026-rename-to-evolai.md)

## Context

Review follow-up task J found three small gaps:

- Two ADRs were both numbered 0020, so "ADR 0020" meant two things. Nothing checked the numbers.
- `.github/CODEOWNERS` named a team (`@auditai/maintainers`) that does not exist, so no review was ever requested.
- The M10, M11 and M13 smokes and the synergy smoke used the constant `99999999-…` as the actor for `audit_log`
  rows. That is the seeded auditor, but the smokes never signed in, so they did not test the path the app uses
  (ADR 0023), and a constant could drift from the real session.

## Decision

1. **Unique ADR numbers, checked in CI.** `scripts/adr-numbers.mjs` fails when two files in `docs/adr/` share a
   number. Its test runs in `pnpm test:scripts`, which the CI build job runs. The later duplicate moved to 0030.
2. **CODEOWNERS names the owner account.** Every rule now points to `@angelstreet`, with the same paths. The
   repository has no team, so a team handle would not request a review.
3. **Smoke actors come from the session.** `apps/web/scripts/smoke-auth.mjs` signs in as the seeded synthetic
   auditor, like the app does, and reads the user id from the session payload (`sub`). The M10, M11 and M13 smokes
   use that id for their `audit_log` rows and no longer accept a `SMOKE_AUDITOR_ID` override. M13 passes the same
   id to the synergy smoke. The synergy smoke runs without a browser, so when run alone it takes the seeded
   auditor membership of the tenant instead; that is the same user the session belongs to.

## Alternatives

- Renumber by hand and rely on review (rejected: the duplicate already got through review).
- Make smokes call the server actions over HTTP instead of writing the audit row with SQL (not done here: the server
  actions need Next action ids, which the smokes cannot discover. The SQL writes stay, labelled as mirroring the
  action, and the actor now matches a real session).
- Keep the constant and add a comment (rejected: it does not test the sign-in path).

## Consequences

- A new ADR that reuses a number fails `pnpm test:scripts` on CI.
- Review requests reach the owner account. Any other maintainer must be added to CODEOWNERS explicitly.
- `m15-smoke.mjs` still uses the constant seeded id. It does not sign in, so it is not changed here; it can follow the
  same pattern when it gains an HTTP step.
