# TASK-X — Email only: no first name, no last name stored or shown anywhere (MVP) (model: sonnet)

Owner decision: anonymise the whole process. Accounts (auditor, referent) are identified by an email address only:
no first name, no surname, no display name is asked, stored or shown. Employees are already anonymous (a respondent code,
no email unless the optional email mode is on).

## Ground rules

- Public repo: no secrets, NO real client or person names anywhere (use "Demo Client" / "Demo Referent"; the BANNED_TERMS
  secret fails the leak scan otherwise). Read AGENTS.md, docs/UI_RULES.md, docs/AUDIT_WORKFLOW.md (MVP scope: small).
- IMPORTANT: on codebox the checkout ~/evolai is on someone else's branch (docs/pilot-runbook). NEVER commit, pull or
  edit in ~/evolai. Make your own worktree: `git -C ~/evolai fetch origin && git -C ~/evolai worktree add -b
feat/task-x-email-only ~/evolai-taskx origin/main` and work only there.
- Owner rule: merge to main yourself when gates pass (format:check, lint, typecheck, test, leak-scan, style-guard,
  Playwright --workers=1) and confirm main CI green and the Vercel deploy READY. ADR for the decision. Forward-only
  migrations: name each in STATUS (the manager applies it to the live Neon DB). Another worker (TASK-W) is changing the
  answer-saving path and privacy notice text: do not touch those files; rebase often.
- HEADLESS RUN RULE: the process exits when you stop calling tools. NEVER end your turn while something is running or
  pending; wait with blocking commands in one tool call (`while pgrep -f playwright >/dev/null; do sleep 15; done;
tail -40 file`, tool timeout 600000). Final answer only when merged and the deploy READY, or truly blocked.
  Keep tool output small (| tail -30); commit and push after each step.
- MEMORY: earlyoom kills big processes. Vitest: `NODE_OPTIONS=--max-old-space-size=1536 corepack pnpm exec vitest run
--pool=forks --poolOptions.forks.singleFork=true <files>`; never vitest and Playwright together; stop servers you start.

## Do

1. **Stop asking for names.** `auditor:create` no longer needs `--name`; `seed:client` drops `--referent-name` (the
   referent persona is created from an email only, or with a generic placeholder address like
   `referent-1@<client-slug>.invalid` that contains no name); admin "invite referent" asks for the email address only;
   any other form asking for a person name (check intake, engagement contact, referent forms, message templates)
   asks for an email or a role label instead. The engagement contact is an email address or a role ("your team
   referent"), not a name.
2. **Stop showing names.** Wherever a user label is displayed (header initials and menu, view-as banner and persona
   list, audit trail "who", referent lists, invitation message "contact", reports) use the email address (or its
   local part truncated) and the role ("Referent", "Auditor") instead of a display name; initials come from the email
   local part. The contact line in the message to employees uses the engagement contact email or role.
3. **Schema:** make `users.display_name` nullable/unused (forward migration; do not drop yet), stop writing it,
   treat null and empty everywhere without crashing (46 mentions today: apps/web/src/lib/authProvider.ts,
   authTokens.ts, clientContext.ts, referentData.ts, auditTrail.ts, adminData.ts, the redaction page, the set-password
   action...). Tests for null display names across the pages that used them.
4. **Existing data script** `pnpm identity:strip-names` (dry run by default, `--apply`): sets display_name to null for
   all users, and for placeholder referent accounts rewrites the placeholder address to a generic one using the existing
   set-email mechanism so no name appears in any address. Idempotent, audit-logged, never prints names or addresses.
   Document in docs/RUNBOOK.md (the manager runs it on the live database after the merge).
5. **Copy and docs:** privacy notice and RUNBOOK say accounts need only an email address; update docs/HANDOVER.md,
   ROADMAP, AUDIT_WORKFLOW. French and English catalogs. Tests (unit, DB, Playwright for invite-by-email-only and
   view-as showing no name; axe), and an ADR.
