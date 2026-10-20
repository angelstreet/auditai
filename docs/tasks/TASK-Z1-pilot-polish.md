# TASK-Z1 — Pilot polish: publish path, reports layout, links and counts, referent home, wording (model: sonnet)

From three acceptance tests (auditor NO 3/10, referent yes-but 6/10, employee yes-but 6/10). Questionnaire content is
TASK-Z2, the last-answer bug is TASK-Y, text masking is TASK-W: do not touch those. MVP: fix defects, add nothing big.

## Ground rules

- Public repo: no secrets, NO real client or person names (use "Demo Client"; BANNED_TERMS fails the leak scan).
- IMPORTANT: on codebox ~/evolai is on someone else's branch. NEVER commit, pull or edit in ~/evolai. Own worktree:
  `git -C ~/evolai fetch origin && git -C ~/evolai worktree add -b fix/pilot-polish ~/evolai-taskz1 origin/main`.
  Other workers are active (W, Z2): rebase before merging.
- Owner rule: merge to main yourself when gates pass (format:check, lint, typecheck, test, leak-scan, style-guard,
  Playwright --workers=1 for touched specs) and confirm main CI green and the Vercel deploy READY. Forward-only
  migrations: name each in STATUS. Short ADR note. Read docs/UI_RULES.md and the skill web-ui-ux-rules.
- HEADLESS RUN RULE: the process exits when you stop calling tools. NEVER end your turn while something is running or
  pending; wait with blocking commands in one tool call (`while pgrep -f playwright >/dev/null; do sleep 15; done;
tail -40 file`, tool timeout 600000). Final answer only when merged and the deploy READY, or truly blocked.
  Keep tool output small (| tail -30); commit and push after each step.
- MEMORY: earlyoom kills big processes. Vitest: `NODE_OPTIONS=--max-old-space-size=1536 corepack pnpm exec vitest run
--pool=forks --poolOptions.forks.singleFork=true <files>`; never vitest and Playwright together; stop servers you start.

## Do

1. **Publishing path (auditor).** The report cannot be published without an accepted improvement step, and no path
   exists when there are no approved opportunities. Allow the auditor to add a manual step ("Write my own": title,
   effort, impact, owner, timing) and to publish a report with findings only. The refusal message must say how to
   continue. The draft text must never claim approvals that did not happen (the Method note says "the auditor checked
   and approved each theme and opportunity" even when none exist): generate it from the actual counts, and warn on the
   report editor when fewer than 5 people answered ("the score and themes are hidden below 5").
2. **Reports pages layout.** `/admin/reports` and `/admin/reports/<id>` render in a column about 480 px wide on
   desktop with clipped tabs and cramped buttons: use the wide admin container like the other admin pages. The PDF
   download control must be visible once a report is published (and say when it is not available yet).
3. **Links and counts.** Show the full invitation links in the app with copy (full list and one by one) and the
   correct scheme: derive from the site URL setting, else the request host and protocol (production is https; a local
   http copy must produce http links). Make the numbers agree everywhere: expected headcount versus links created
   versus invited versus opened; the Engagements list shows 0 invitations while the Invitations page shows 17 and a
   single opened link shows "Opened 2": find and fix the counting differences, with a test.
4. **Copy and share on phones.** Copy buttons use the clipboard API with a fallback (textarea select + execCommand)
   and the native share sheet (`navigator.share`) when available; the failure message must not tell people to select
   truncated text: show the full link in a selectable field instead.
5. **Referent home and report tab.** Add a short "how it works" box on the referent home (what the team is asked, how
   long it takes, who sees what, the 3 steps: send, remind, report); make the reminder actionable (a date and one
   "copy the reminder" button); the Rapport tab states what the referent will receive and when, with how to forward it
   (PDF or print); the logo link for a signed-in referent goes to /client not the public welcome page; the view-as
   banner shows the full text (wrap or tooltip); the status words are consistent in French and English.
6. **Small wording and states.** One consistent privacy sentence on the employee intro, done page and privacy page
   (who sees what; ONE way to withdraw or erase that does not go through the manager: reuse the existing privacy request
   form); the link expiry shown to the employee must match the engagement closing date or the invitation expiry
   (pick one source of truth); save confirmations (snackbar) for team size and dates; accessible names on the answer
   buttons; the "Survey language" label no longer overlaps its value in engagement settings.
7. Tests (unit, Playwright fr/en, 360 and 1280, axe, keyboard) and docs (AUDITOR_GUIDE, HANDOVER).
