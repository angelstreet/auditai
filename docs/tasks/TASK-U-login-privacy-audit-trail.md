# TASK-U — Real referent login, complete privacy notice, audit trail and data-page safety (model: sonnet)

Readiness items 1, 2, 12 and 13 of docs/AUDIT_WORKFLOW.md and docs/TEST_FEEDBACK_2026-10-19.md. Another worker
(TASK-S) is finishing the referent pages under apps/web/src/app/client: do not edit those files. Rebase often.

## Ground rules

- Public repo: no secrets, NO real client or person names (use "Demo Client" / "Demo Referent"; the BANNED_TERMS
  secret fails the leak scan otherwise). Read docs/UI_RULES.md, the skill ~/.claude/skills/web-ui-ux-rules/SKILL.md,
  AGENTS.md. Own worktree + branch off origin/main. Owner rule: merge to main yourself when gates pass
  (format:check, lint, typecheck, test, leak-scan, style-guard, Playwright --workers=1) and confirm main CI green and
  the Vercel deploy READY. ADR for decisions (next free number at merge time). Forward-only migrations: name each
  one in your final STATUS (the manager applies it to the live Neon DB).
- HEADLESS RUN RULE: the process exits when you stop calling tools. NEVER end your turn while something is running or
  pending: wait with blocking commands in one tool call (`while pgrep -f playwright >/dev/null; do sleep 15; done;
tail -40 file`, tool timeout 600000). Give a final answer only when the PR is merged and the deploy READY, or you
  are truly blocked (STATUS: blocked: reason). Keep tool output small (| tail -30); commit and push after each step.
- MEMORY: the box kills big processes (earlyoom). Vitest: `NODE_OPTIONS=--max-old-space-size=1536 corepack pnpm exec
vitest run --pool=forks --poolOptions.forks.singleFork=true <files>`; never vitest and Playwright together;
  stop servers you start.

## Do

1. **Real login for a referent, self-service.** Today a referent persona has no password and a placeholder address.
   Build: owner action "invite this referent" (admin, tenant-scoped, audited) that stores the real address (hashed
   for lookup, encrypted or only held as long as needed per ADR 0033/0035 rules: keep the project's existing email
   handling pattern), creates a single-use, expiring set-password token and shows the link to the owner to send
   (email delivery only if the existing provider interface is configured, otherwise copy link). Page
   `/set-password?token=...`: plain words, strength rule (12+ chars), show/hide icon, success goes to /client.
   Also `/forgot-password` and a reset link flow with the same token mechanism (no user enumeration: same message
   whether or not the address exists; rate limited; tokens hashed at rest, single use, 60 minutes). Login page gets
   a "Forgot password?" link. Referent sessions still land on /client, never admin. Tests for token reuse, expiry,
   enumeration, rate limit, and role landing; update docs/RUNBOOK.md ("give a referent a real login").
2. **Privacy notice complete (public /privacy, fr and en)** with configurable fields per engagement/organisation:
   controller (organisation name), contact for privacy questions (email/role), purpose, legal basis, what is
   collected and what is not (no names), who sees what (auditor, referent: counts only, sponsor: approved results),
   retention period (from the engagement setting), sub-processors and hosting region, AI use and the approved
   route (shown only when AI analysis is on), how to withdraw or erase without going through a manager (a plain
   request form that notifies the auditor), and rights. Fields are editable in the admin engagement settings with
   safe defaults and a "not configured yet" warning on the admin side; the public page never shows empty
   placeholders (hide the section until configured and say who to ask). The employee entry page shows who is asking
   (organisation, contact person), the purpose and time needed, taken from the same fields.
3. **Audit-trail screen (admin):** readable list of who exported, erased, viewed-as, created invitations, changed
   settings, with date, actor, action in plain words, filter by action and date, CSV export; no payload secrets.
4. **Data page safety:** erase of a nonexistent respondent code says clearly "no such respondent" (not a green
   check), requires typing the code to confirm, shows what will be deleted; the export shows a download button and
   plain column names; a respondent can be found by invitation batch/date without exposing identity (auditor only).
5. **Mascot / small-cell guard:** team mascot and any per-team result is hidden when fewer than the minimum group
   (5) completed answers; tests; explain once "hidden under 5 people to protect privacy".
6. Tests (unit, DB/RLS where tenant data is involved, Playwright fr and en, 360 and 1280, axe, keyboard), docs
   (HANDOVER, ROADMAP, RUNBOOK, UX_AUDIT changelog) and ADRs.
