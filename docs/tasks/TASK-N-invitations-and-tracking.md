# TASK-N — Invitations, reminders and response tracking (FR-03) (model: sonnet)

PRD FR-03: secure invitation links, expiry, reminders, response tracking. Today there is a single-use invite
token (HMAC, expiry, single-use) and the respondent flow, but no way for an auditor to create invitations in bulk,
see who has answered, or remind people. Privacy is a hard rule (PRD sections 15 and 25.1): the auditor and the
client never see who gave which answer; managers see aggregates only; respondents are pseudonymous.

## Ground rules

- Public repo: no secrets, no real emails or names in fixtures (synthetic, `.invalid` domains). Own worktree +
  branch. Owner rule: merge to main yourself when gates pass (`format:check`, `lint`, `typecheck`, `test`,
  `leak-scan`, `style-guard`, Playwright with 1 worker) and confirm main CI green and the Vercel deploy READY
  (every push to main deploys to production). ADR for decisions. Do not ask questions. End with `STATUS: ...`.
- Another worker (TASK-L, Opus) is restyling all screens with MUI components from `packages/ui` right now. Do NOT
  edit existing page, layout or header files. Build backend, scripts and API first; admin screens go in NEW files
  under `apps/web/src/app/admin/invitations/` using `packages/ui` components and `docs/UI_RULES.md` (and the
  skill `~/.claude/skills/web-ui-ux-rules/SKILL.md`); pull main before starting that part so you build on L's
  merged theme (check `git log` for the L merges; if the theme is not on main yet, finish backend first, then
  pull again).
- The codebox is shared and low on RAM: one Playwright worker, stop dev servers when done.

## Do

1. **Bulk create** (admin, tenant-scoped, session actor): create N invitations for an engagement from a list of
   labels (department/team, optional) or just a count; each gets a single-use signed link with expiry. Output
   CSV (link, team) and a printable QR sheet, so the client's HR distributes them. Default mode stores NO email
   addresses and NO names.
2. **Optional email delivery** behind a provider interface (mock provider for tests and CI; one real adapter for
   an EU transactional-email service configured only by env, no key in repo; fail closed when unconfigured).
   In this mode the address is held only as long as needed to deliver and to send reminders (encrypted with an
   app key, auto-purged by the retention worker and on completion), never joined to answers. ADR with the
   privacy analysis. Behind a per-engagement setting, off by default.
3. **Response tracking**: per engagement and per team: invited, opened, started, completed counts and rate, last
   activity day (no timestamps finer than a day), with a minimum group size (5) below which a team shows only
   "fewer than 5". Never expose which invitation completed to anyone below auditor role, and never join it with
   answers in any view or export.
4. **Reminders**: a rule (for example after 3 and 7 days, only invitations not completed, stop at expiry) run by
   the existing cron route pattern (protected by `CRON_SECRET`); in the default no-email mode it produces a
   reminder list (links of not-yet-completed invitations, without any identity) the client can resend; in email
   mode it sends via the provider. Idempotent, rate-limited, audit-logged.
5. **Revoke and extend**: revoke an invitation, extend expiry, regenerate a lost link (old link dies).
6. **Admin screens (new files)**: an Invitations page per engagement: create, progress tiles (StatTiles),
   per-team progress bars, export, reminder list, revoke. Plain short words, French and English catalogs,
   icons from the registry, one primary action per view, passes the jargon test only where respondents see
   text (admin may be denser but follows UI_RULES).
7. **Tests**: unit and DB tests (RLS isolation across tenants for every new table and route, min-group-size
   suppression, no-PII assertions: scan the schema and exports for email/name columns in default mode),
   Playwright for the admin flow, a smoke script `pnpm n:smoke`. Update docs/HANDOVER.md, ROADMAP (FR-03 status)
   and docs/RUNBOOK.md (how to create invitations on the live database, how to run reminders).
