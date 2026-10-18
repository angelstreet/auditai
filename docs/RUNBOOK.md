# EvolAI — runbook (production)

Live site: evolai.io and www.evolai.io, Vercel project `evolai` (team: the owner's scope in the Vercel dashboard),
database: Neon Postgres in Frankfurt. Secrets never go in git or in chat: they live in Vercel sensitive environment
variables and in the owner's private env file (named below as `$ENV_FILE`).

## Where things are

| What                  | Where                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Code                  | this repo, branch `main`; the Vercel project root is `apps/web` (`apps/web/vercel.json`)  |
| App DB role           | `auditai_app` (restricted, subject to row-level security); migrations run as the owner    |
| Pooled DB URL         | `DATABASE_URL` (Vercel env and `$ENV_FILE`)                                               |
| Direct (unpooled) URL | `DATABASE_URL_UNPOOLED` in `$ENV_FILE` only; used for migrations and the auditor commands |
| App secrets           | `AUTH_SESSION_SECRET`, `SURVEY_SIGNING_SECRET`, `DATABASE_APP_PASSWORD`, `CRON_SECRET`    |

Load the file into a shell without printing it: `set -a; . "$ENV_FILE"; set +a`.

## Deploy and roll back

- A push to `main` deploys to production automatically. Keep `main` green (CI: format, lint, typecheck, tests,
  leak-scan, style-guard, Playwright). A pull request gets a preview deployment.
- Migrations are **not** run by the deploy. Apply them first when a change adds one (next section), then merge.
- Roll back: Vercel dashboard, project `evolai`, Deployments, pick the last good deployment, "Promote to Production"
  (or `vercel rollback`). A rollback does not undo migrations; migrations are forward-only and backward compatible
  with the previous release, so the previous build still runs.
- Check after a deploy: `curl -fsS https://evolai.io/api/health` returns `{"ok":true,"db":true}`.

## Apply migrations to Neon

```bash
set -a; . "$ENV_FILE"; set +a
DATABASE_URL="$DATABASE_URL_UNPOOLED" node infra/db/scripts/migrate.mjs
```

The runner is idempotent and prints `+` for each file it applies. Never run `seed-synthetic-auth.mjs` against a
deployed database (it refuses under `NODE_ENV=production`; do not work around that).

## Auditor accounts

Run from the repo root with `$ENV_FILE` loaded. The password is typed at a hidden prompt (or piped on stdin), never
on the command line. Minimum 12 characters. Tenant ids are the `tenants.id` values of the live database.

```bash
set -a; . "$ENV_FILE"; set +a
pnpm auditor:create --email <address> --name "<Full Name>" --tenant <tenant-uuid> [--tenant <tenant-uuid>]
pnpm auditor:set-password --email <address>
pnpm auditor:disable --email <address>
```

The command uses `DATABASE_URL_UNPOOLED` when set. If both URLs are set and point at different hosts it refuses.
Add `--expect-host <direct Neon host>` to pin the target. Every change writes an `audit_log` row. The first auditor
on the live database: `auditor:create` with the live tenant ids, then sign in at `/login`.

If a user is locked out (5 failures in 15 minutes), wait 15 minutes. Nothing else to do.

## Rotate secrets

1. **App secrets** (`AUTH_SESSION_SECRET`, `SURVEY_SIGNING_SECRET`, `CRON_SECRET`): generate a value with
   `openssl rand -base64 48`, write it to `$ENV_FILE`, set it in Vercel (Settings, Environment Variables, mark
   Sensitive), redeploy. Rotating `AUTH_SESSION_SECRET` signs everyone out; rotating `SURVEY_SIGNING_SECRET`
   invalidates every invitation link already sent (re-issue them), so do that only if it leaked.
2. **DB app password** (`auditai_app`): `ALTER ROLE auditai_app WITH PASSWORD '<new>'` through the direct URL (psql
   prompts; do not paste the password into a shared place), update `DATABASE_APP_PASSWORD` in `$ENV_FILE` and
   Vercel, redeploy. Check `/api/health`.

## Invitations and reminders (FR-03, ADR 0033)

Create links on the live database (default mode: no names, no addresses). Sign in as an auditor, then either use
the admin screen _Invitations_ (`/admin/invitations`, pick the engagement; create, progress by team, CSV, printable QR sheet at `/admin/invitations/sheet`, reminders, revoke, extend), or the JSON API with the session cookie:

```bash
set -a; . "$ENV_FILE"; set +a
BASE=https://evolai.io
curl -sS -c jar -X POST "$BASE/api/auth/login" --data-urlencode "email=$AUDITOR_EMAIL" \
  --data-urlencode "password=$AUDITOR_PASSWORD"   # prompt for the password, do not paste it into history
curl -sS -b jar -H 'content-type: application/json' "$BASE/api/admin/invitations" \
  -d '{"tenantId":"<tenant>","engagementId":"<engagement>","op":"create","counts":{"<team id>":25},"expiresInDays":14}'
curl -sS -b jar "$BASE/admin/invitations/export?tenant=<tenant>&engagement=<engagement>" -o links.csv
```

The CSV is `link,team` and lists links not yet completed. Hand it to the client's HR; never mail it to yourself in
clear text. Progress: `GET /api/admin/invitations?tenant=..&engagement=..` (aggregates; teams under 5 show nothing).
Revoke, extend, regenerate: `op` = `revoke | extend | regenerate` with `invitationId`.

Reminders run from `apps/web/vercel.json`: `GET /api/cron/reminders` daily at 07:43 UTC with the same
`CRON_SECRET` bearer as the retention route. Default mode: it only counts what is due; use the _Reminder list_
(`...&view=reminders`, or `/admin/invitations/export?...&kind=reminders`) and press "mark as resent" after the
client sends it. Email mode (per engagement setting, off by default): it sends and consumes each step, then purges
stored addresses. Run it by hand: `curl -sS -H "Authorization: Bearer $CRON_SECRET" "$BASE/api/cron/reminders"`;
the body is `{ok, engagements, sent, failed, listModeDue, purged, emailUnavailable}`.

Email mode needs `INVITE_EMAIL_KEY` (`openssl rand -base64 32`), `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY` and
`EMAIL_FROM` in Vercel (Sensitive). Without them, creating with addresses fails before anything is stored.
Rotating `INVITE_EMAIL_KEY` makes stored addresses unreadable (they are short-lived: purge them first by revoking
or waiting for expiry). Migration 0018 must be applied first (previous section).

## Health and monitoring

Point an uptime check (any external monitor, 1-minute interval) at `https://evolai.io/api/health`; alert on a
non-200 answer or a body other than `{"ok":true,"db":true}`. The route reads no data. Runtime errors:
Vercel dashboard, Logs.

## Retention worker (Vercel cron)

`apps/web/vercel.json` calls `GET /api/cron/retention` daily at 03:17 UTC. Vercel sends
`Authorization: Bearer $CRON_SECRET` when the `CRON_SECRET` environment variable is set on the project (set it, 16+
characters; without it the route always answers 401). There is no public trigger. A pass erases pseudonyms whose
badges are all past retention (ADR 0030). Check in the dashboard (Settings, Cron Jobs) that the job ran and that its
last status is 200; its JSON body is `{ok, tenantsScanned, purged}`.

## Backups and recovery drill (Neon branch, about 20 minutes)

Neon keeps point-in-time history for the plan's restore window, and a branch is a cheap copy-on-write clone. The
drill proves a restore works without touching production:

1. In the Neon console, project of the live database, Branches, "Create branch" from the production branch with
   "Past data" set to a time one hour ago (or the current time if the plan has no window). Name it `drill-<date>`.
2. Copy that branch's **direct** connection string into a temporary file (not into chat or git).
3. `DATABASE_URL_UNPOOLED=<branch url>` then run: `DATABASE_URL="$DATABASE_URL_UNPOOLED" node infra/db/scripts/migrate.mjs`
   (expect only `=` lines: the branch already has every migration).
4. Check the data: connect with psql and run `SELECT count(*) FROM tenants; SELECT count(*) FROM users;
SELECT count(*) FROM audit_log;` and compare with production.
5. Point a preview deployment at the branch (a preview environment variable `DATABASE_URL`) or run `pnpm local:up`
   with that URL, sign in with a real auditor, open `/admin/data`.
6. Write the date, the restore point used and the time it took in `docs/HANDOVER.md` under Gate C, then delete the
   branch in the Neon console.

Gate C needs this drill done once with a real result; this runbook does not claim it.
