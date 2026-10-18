# 0032 - Production readiness: no public credentials, real auditors, login hardening, health and cron

- Status: Accepted
- Date: 2026-10-18
- Related: [0023](0023-auditor-auth-and-session.md), [0030](0030-pseudonym-erasure-cascade.md), [0003](0003-postgres-migrations-and-rls.md)

## Context

The app is live on Vercel with a Neon Postgres database in Frankfurt. Migration 0015 seeded two synthetic auditors
whose passwords are written in this public repo. The sign-in had no throttling, the response had no security
headers, the public home page still carried a milestone label, a function ran outside the database region, pg
warned about the `sslmode` alias, and there was no health check, runbook or scheduled retention.

## Decision

1. **No public credentials in a deployed database.** Migration 0017 (forward only, 0015 stays untouched) clears
   `password_hash` for the two synthetic users. The hashes now live in `infra/db/scripts/seed-synthetic-auth.mjs`,
   called by the local runner and Playwright after the migrations; it refuses to run when `NODE_ENV=production`.
2. **Real auditors by CLI.** `pnpm auditor:create | auditor:set-password | auditor:disable`
   (`infra/db/scripts/auditor*.mjs`). The password comes from a hidden prompt or stdin, never argv, is never
   logged, is at least 12 characters, and is hashed with the same scrypt format as the login. The CLI connects with
   `DATABASE_URL_UNPOOLED` (else `DATABASE_URL`), refuses when both are set and point at different hosts
   (a pooled and a direct Neon endpoint of one database count as the same), and accepts `--expect-host`. Each change
   writes `audit_log` rows (`user.create`, `user.set_password`, `user.disable`, target kind `user`, actor = the system
   user). `users.disabled_at` blocks sign-in.
3. **Login hardening.** Failures are counted per e-mail digest and per client-address digest in `login_attempts`
   (Postgres, no new infrastructure): 5 per e-mail and 20 per address in 15 minutes lock sign-in. The e-mail limit
   applies to any string, so a lockout does not reveal which accounts exist; "right password, no tenant" returns the
   same message as a wrong password; an unknown user still costs one scrypt verification. Security headers (CSP with
   `frame-ancestors 'none'`, HSTS, nosniff, referrer policy, permissions policy) come from `next.config.js`;
   `/admin`, `/login`, `/board` and `/api` send `X-Robots-Tag: noindex` and `robots.txt` disallows them. The CSP
   keeps `'unsafe-inline'` for scripts because Next.js emits inline bootstrap code; nonces are a later step.
4. **Fail closed on the invitation secret.** `SURVEY_SIGNING_SECRET` has a public development default. In production
   without a real value (16+ characters) signing and verifying now throw, as the session secret and the DB password
   already did. The local runner and Playwright opt in through `ALLOW_DEV_DB_PASSWORD=1`.
5. **Public wording.** The home page, About and privacy texts lost the milestone label, "synthetic" and "development"
   wording, the tenant line and the board link; About no longer mints a sample-survey link. A Playwright spec checks
   the public pages in both languages.
6. **Region and TLS.** `apps/web/vercel.json` pins `fra1`; the health and cron routes also set `preferredRegion`.
   `db.ts` passes an explicit `ssl` option: none for loopback or `sslmode=disable`, otherwise
   `rejectUnauthorized: true`. `sslmode` is removed from the string because pg lets the string override `ssl`.
7. **Health and cron.** `GET /api/health` runs `SELECT 1` as the app role and returns `{ok, db}` (503 if the database
   is down). `GET /api/cron/retention` runs one retention pass (same rule and SQL function as the worker of ADR 0030)
   and only answers a request that carries `Authorization: Bearer $CRON_SECRET` (Vercel sends it); anything else gets
   an empty 401. Schedule: daily in `vercel.json`.
8. `docs/RUNBOOK.md` records deploy, rollback, migrations, secret rotation, the recovery drill and these commands.

## Alternatives

- Edit migration 0015 (rejected: applied migrations are never edited).
- Delete the synthetic users (rejected: seeds, smokes and RLS tests refer to their ids).
- A Redis or edge rate limiter (rejected: new infrastructure for one admin form).
- Import the retention worker from `@evolai/ai` into the web app (rejected: it would pull the model SDK into the web
  bundle; the pass is 20 lines of SQL, kept in step by a comment).
- Nonce-based CSP now (deferred: needs per-request middleware and dynamic rendering of every page).

## Consequences

- A deployed database has no usable password until the owner runs `pnpm auditor:create` (RUNBOOK).
- Local and CI runs must call `seed-synthetic-auth.mjs` after `migrate.mjs`; the runner and Playwright do. Anyone
  running `docker compose` has no sign-in until they create an auditor.
- A person who mistypes an e-mail five times waits 15 minutes; a correct sign-in clears that e-mail's counter.
- The cron and health routes sit outside the auditor middleware on purpose; the cron has its own secret.
- Open: `/intake` and `/quiz` are still public pages that list tenants and (for intake) the latest sponsor brief
  and accept writes without a session. Fine for the seeded test tenants, a decision for the owner before real
  tenants exist (gate behind sign-in or a signed sponsor link).
