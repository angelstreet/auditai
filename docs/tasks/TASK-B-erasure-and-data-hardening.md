# TASK-B — Real right-to-erasure + data-layer hardening (model: sonnet)

## Ground rules (read first)
- Repo: auditai (public: no secrets, IPs, hostnames, client names). Read AGENTS.md and the ADRs you touch. Use pnpm (`corepack pnpm`; put a `pnpm` shim on PATH if turbo cannot find it).
- Work in your OWN git worktree + branch (`git worktree add ~/auditai-<task> -b <task-branch> origin/main`). Never edit ~/auditai directly. Open a PR; do not merge other tasks work. Rebase on main before the PR.
- Gate before PR: `pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run leak-scan`, plus the relevant `pnpm mNN:smoke` after `pnpm local:up`. Report which gates you actually ran.
- Add a new ADR for each significant decision. Tests with every change.
- Owner autonomy rule from AGENTS.md applies. Ask only for credentials, money, real data, licence, irreversible actions.
- Context: a review of M15 (main @ 89ff7a8) found the items below. Other workers handle the other tasks in parallel (see docs/tasks/); keep to your scope and file set.
- End with `STATUS: done — ...` / `needs-owner: ...` / `blocked: ...`.

## Problem
1. deletePseudonym (apps/web/src/lib/deletionData.ts) and the retention worker (services/ai/src/retentionWorker.ts) delete only respondent_badges. The contract lists synergy/opportunity/analysis/engagement/tenant targets but nothing writes them; the same pseudonym's submissions/answers/analyses remain. FR-09 is not met.
2. The retention worker is a function with no scheduler.
3. CSV export (apps/web/src/lib/exportData.ts rowsToCsv) does not neutralise cells starting with = + - @ (formula injection; exports hold respondent free text).
4. apps/web/src/lib/db.ts builds SET LOCAL app.tenant_id with string interpolation; safe only because callers validate.
5. db.ts falls back to password 'auditai' and docker-compose uses auditai/auditai: must fail closed in production.

## Do
1. Inventory every table holding a pseudonym or derived from it (grep infra/db/migrations). ADR: per table, delete vs anonymise vs keep-with-justification (aggregates, audit_log is append-only: keep, record erase event). Implement the cascade in one transaction in deletePseudonym and share the logic with the retention worker (one function, two callers). One deletion_events row per target kind removed; audit_log row per erase.
2. Verify with a test that after erase NO row anywhere still carries the pseudonym (query every table), and that other pseudonyms/tenants are untouched (RLS).
3. Provide a runnable schedule for the retention worker (a script entry + documented systemd timer / cron / compose service; no hosts or secrets in repo) and a smoke test.
4. CSV: prefix a single quote on cells beginning with = + - @ or tab/CR; unit tests incl. negative numbers staying readable where type is numeric.
5. db.ts: use select set_config('app.tenant_id', $1, true) (parameterised) and validate the UUID inside withTenant. Same for any other interpolated SET.
6. Production guard: when NODE_ENV=production, throw if DATABASE_APP_PASSWORD is unset or equals the dev default.
## Out of scope
Auth/session and actor id (TASK-A, which edits actions.ts - do not touch it), i18n (TASK-C).
