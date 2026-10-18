# TASK-P — "View as" switcher for the owner, and the client referent view (model: opus)

Owner request: during the dev phase the owner (Joachim, platform owner and auditor) must be able to test both
experiences: (1) his own auditing view, (2) the client's view. First client: **Stratera**, whose team referent is
**Zakaria Ayadi**. The owner switches between the views from the app without logging out.

## Facts

- Roles already exist in `memberships.role` (migration 0001): `platform_owner`, `client_sponsor`, `auditor`,
  `security_reviewer` and the team referent role (check the exact constraint values). PRD sections 4.3, 15 and
  the role matrix (lines ~105-115 and 351, 414): a **team referent** coordinates preparation, invites employees,
  sees completion counts and reminders and verifies process facts; the referent **cannot see individual answers or
  individual maturity results**. A **client sponsor** sees aggregated reports of their own tenant only.
- Auth is ADR 0023 (session cookie, tenant memberships, real actor in audit rows). Invitations/tracking is FR-03
  (merged: `/admin/invitations`, min group size 5). UI rules: `docs/UI_RULES.md` and the skill
  `~/.claude/skills/web-ui-ux-rules/SKILL.md`. Header account menu exists (TASK-L).
- Another worker (TASK-L4) may still be merging UI files (account menu, intake). Rebase often, prefer NEW files,
  keep edits to existing files small and merge early to limit conflicts.

## Ground rules

- Public repo: no secrets, no real emails. Own worktree + branch off origin/main. Owner rule: merge to main
  yourself when gates pass (`format:check`, `lint`, `typecheck`, `test`, `leak-scan`, `style-guard`, Playwright 1
  worker) and confirm main CI green and the Vercel deploy READY (every push to main deploys production). ADR for
  decisions. Headless run: you cannot ask questions. Keep tool output small (`| tail -30`), commit and push
  often. End with `STATUS: ...`; say which migration (forward-only) the manager must apply to the live Neon DB.

## Do

1. **View-as, server-enforced (security first).** Only a user with the platform owner role may use it. The
   session keeps the real user and an optional `viewAs` {role, tenantId, label}. Every server component, route
   and action derives the effective role and tenant from the session on the server; the UI hiding things is not
   security. Rules: a non-owner can never set `viewAs` (tests: forged cookie, forged form field, direct POST);
   in a client view-as the session is READ-ONLY (all mutating actions refused with a clear message, tests for each
   existing action); every request while viewing as is audit-logged with the real actor id and the "as" role/tenant;
   the signed session cookie includes `viewAs` so it cannot be edited client-side; exiting restores the owner view;
   view-as expires with the session. No emails sent, no side effects triggered by viewing.
2. **Visible and reversible UI.** In the header account menu (owner only): a "View as" section listing
   "Me: auditor" and one entry per client persona (for now "Stratera: Zakaria Ayadi, referent"). While active, a
   sticky, impossible-to-miss banner under the header (UI_RULES: icon, one line, e.g. "You are viewing Stratera as
   Zakaria Ayadi (referent). Read only." plus a "Back to my view" button), the avatar shows the persona's initials,
   and the page title area states the tenant. French and English catalogs, tooltips and aria-labels, works in
   light and dark.
3. **The client referent experience** (new routes, e.g. `/client/...`, plain short words, no jargon, icons,
   one primary action per view; it is also what a real referent will see after a real login later):
   - Home: completion progress for their team(s) (invited, started, completed, with the "fewer than 5" rule),
     what is next, a plain status line.
   - Invitations for their team: create/export links and QR sheet and see the reminder list (reuse FR-03 services
     scoped to the referent's team and tenant), never any link-to-answer mapping.
   - Results: only what the auditor has approved/published for the client (aggregate themes, approved
     opportunities with status), no individual answers, no raw quotes that could identify a person; a "nothing
     published yet" empty state.
   - Navigation specific to this role (no auditor/admin links); tenant switcher absent (one organisation).
   - Tenant isolation proven with tests: referent of Stratera cannot read any other tenant, any other team's
     detail, answers, or admin routes (403/redirect), including by guessing ids.
4. **Seed the first client** (idempotent script `pnpm seed:client` or similar, safe to run on the live DB, never
   in a migration, refuses without an explicit `--tenant-name`/flags): create tenant "Stratera", one engagement
   "Pilote Stratera" (fr), a team, a membership for the owner as auditor on that tenant, and the referent persona
   user "Zakaria Ayadi" with the referent role. The referent gets NO password and a non-deliverable placeholder
   email on the reserved `.invalid` domain until the owner supplies a real address; the account is not loginable. Data is
   synthetic only (no real survey answers). Document in docs/RUNBOOK.md how to later give Zakaria a real login
   (set real email and password via the auditor CLI pattern) and how to remove the placeholder.
5. **Tests and docs**: unit and DB tests for the session/viewAs logic and RLS, Playwright for the owner switching
   to the referent view and back (banner, read-only, nav, isolation) in fr and en at 360 and 1280, axe clean;
   update docs/UI_RULES.md (view-as banner pattern), docs/HANDOVER.md, docs/ROADMAP.md, docs/RUNBOOK.md and add
   an ADR (threat model for impersonation).
