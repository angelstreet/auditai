# 0026 - Rename the project to EvolAI (TASK-F)

- Status: Accepted
- Date: 2026-10-18
- Deciders: maintainers
- Related: [0023](0023-auditor-auth-and-session.md), [0024](0024-i18n-fr-en.md), [0018](0018-devx-and-deploy.md)

## Context

The product is EvolAI; the repository is already `angelstreet/evolai` (old URLs redirect). "AuditAI/auditai"
remained as the working name in package scopes, URLs, cookies, temp paths and database identifiers.

## Decision

- **Renamed**: package scope `@auditai/*` to `@evolai/*` (names, imports, lockfile), root package, Docker image
  `evolai-web`, repository URLs and CI badges, LICENSE holder text, CSV export filename, temp/log paths, systemd
  and `/opt` examples, ephemeral test/dev database names (`evolai_test`, `evolai_local`), the locale cookie
  (`evolai_locale`) and the session cookie (`evolai_session`, was `aai_session`).
- **Cookies**: the old names are still read as a fallback (`readSessionCookie`, `LEGACY_LOCALE_COOKIE`), so open
  sessions and language choices survive. New logins and language choices write the new names; logout clears both.
  The fallback can be removed once the longest session TTL (8 h) and the locale cookie lifetime (1 year) have passed.
- **Database: keep the internal identifiers.** The app role `auditai_app`, the Postgres bootstrap user/password
  `auditai` and the compose database `auditai` are not renamed. Migrations 0004 onward grant to that role, and old
  migrations must never be edited; a forward migration that renames the role would break any running deployment
  that still uses `DATABASE_APP_USER` defaults mid-rollout, and compose volumes ignore `POSTGRES_*` after first init.
  `DATABASE_URL`, `DATABASE_APP_USER` and `DATABASE_APP_PASSWORD` keep working unchanged, so existing values need
  no fallback code. Comments in `db.ts` and `docker-compose.yml` say why.
- **Alternatives**: a forward `ALTER ROLE ... RENAME` migration plus env change (rejected: coordinated rollout risk
  for zero user value); renaming everything and forcing re-login (rejected: avoidable disruption).

## Consequences

`git grep -i auditai` leaves only these intentional hits:

- this ADR and the notes in ADR 0023 / 0024; older ADR bodies, `docs/tasks/*` and `docs/ROADMAP.md` M8 row (history);
- `infra/db/migrations/*` (history, never edited);
- the retained role/user/password `auditai_app` / `auditai` in `db.ts`, `docker-compose.yml`, `Dockerfile` comment,
  CI service config, local-stack, Playwright and DB test setup, smokes, AI workers' `SET ROLE`, README and landing
  local-dev `DATABASE_URL` examples;
- the legacy cookie names (`aai_session`, `auditai_locale`) in the fallback code;
- `.github/CODEOWNERS` is unchanged (team handle, not a package scope).

The owner renames checkout folders on the hosts after merge; nothing here touches them.

## Addendum (TASK-J): remaining `auditai` hits, October 2026

Audit of `git grep -i auditai` outside `docs/adr/` after TASK-H and TASK-I. Two changes were made:

- `landing/index.html` and `landing/m15-contracts/index.html` named the old package scope `@auditai/*`. They now
  say `@evolai/*`, the real package names.
- `.github/CODEOWNERS` named a team (`@auditai/maintainers`) that does not exist. It now names the owner account
  `@angelstreet`, with the same path rules. This reverses the line in Consequences above.

Kept on purpose, with the reason:

| Hits                                                                                                                                                                                                                                                                                       | Reason                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `auditai_app` role, `auditai` bootstrap user, password and compose database (`db.ts`, `docker-compose.yml`, `Dockerfile` comment, CI and e2e service config, `local-stack.mjs`, `serve.mjs`, `tests/db`, smokes, `SET ROLE` in `services/ai`, README and landing local-dev `DATABASE_URL`) | Internal database identifiers. Running databases use them and migrations 0004 onward grant to them (see Decision). |
| `infra/db/migrations/0001_init.sql` header comment and other migration comments                                                                                                                                                                                                            | Migration history; old migrations are never edited.                                                                |
| `LEGACY_LOCALE_COOKIE = 'auditai_locale'` in `packages/i18n` and the legacy session cookie `aai_session`                                                                                                                                                                                   | Cookie names read as a fallback so open sessions and language choices survive the rename.                          |
| `docs/tasks/*` briefs and the `docs/ROADMAP.md` M8 row                                                                                                                                                                                                                                     | Records of the task as written; the repository name `auditai` in them is the old name.                             |
| `docs/adr/*` bodies                                                                                                                                                                                                                                                                        | ADR history.                                                                                                       |

The retention of these identifiers is checked by reading this list, not by a test. Any new `auditai` hit outside
these groups should be renamed.
