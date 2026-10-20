# TASK-Y — Bug: the survey is submitted when the done page loads, so the last answer can be lost (high priority) (model: sonnet)

Found by an acceptance tester on a production build: on the last question the "answer saved" call returned 409
`already_submitted` and the screen blamed the network. Cause (checked in the code):
`apps/web/src/app/s/[token]/done/page.tsx` calls `submitState(...)` during a GET render. The last question page
(`apps/web/src/app/s/[token]/q/[index]/page.tsx`, `nextHref` = `/s/<token>/done` when `isLast`) renders a link to that
page; Next prefetches links in production, so merely opening the last question can submit the survey before the
person answers, after which `/api/answer` refuses the answer (`isSubmitted` -> 409).

## Ground rules

- Public repo: no secrets, NO real client or person names (use "Demo Client" / "Demo Referent"; BANNED_TERMS fails
  the leak scan otherwise). Keep it small and surgical (MVP).
- IMPORTANT: on codebox ~/evolai is on someone else's branch. NEVER commit, pull or edit in ~/evolai. Make your own
  worktree: `git -C ~/evolai fetch origin && git -C ~/evolai worktree add -b fix/submit-on-finish ~/evolai-tasky
origin/main` and work only there. Another worker (TASK-W, anonymisation) is editing `app/api/answer/route.ts`: keep
  your change there minimal and rebase before merging.
- Owner rule: merge to main yourself when gates pass (format:check, lint, typecheck, test, leak-scan, style-guard,
  Playwright --workers=1 for the survey specs) and confirm main CI green and the Vercel deploy READY. A short ADR
  note is enough. No migration expected.
- HEADLESS RUN RULE: the process exits when you stop calling tools. NEVER end your turn while something is running or
  pending; wait with blocking commands in one tool call (`while pgrep -f playwright >/dev/null; do sleep 15; done;
tail -40 file`, tool timeout 600000). Final answer only when merged and the deploy READY, or truly blocked.
  Keep tool output small (| tail -30); commit and push after each step.
- MEMORY: earlyoom kills big processes. Vitest: `NODE_OPTIONS=--max-old-space-size=1536 corepack pnpm exec vitest run
--pool=forks --poolOptions.forks.singleFork=true <files>`; never vitest and Playwright together; stop servers you start.

## Do

1. **No data change on GET.** The done page must be read-only: if the survey is submitted, show the thank-you; if not,
   do NOT submit: redirect to the first unanswered (not skipped) question, or show a "one more step" with a button to
   finish. The prefetch must never change state: also set `prefetch={false}` on the link/redirect to done.
2. **Explicit finish.** Submission happens through an explicit POST (a server action or `POST /api/submit`) triggered by
   finishing the last question (after its answer or skip is saved) and only then navigates to done. Idempotent: a
   second finish call returns ok. Keep the `purgeDelivery` behaviour. Required rule: every question answered or skipped
   before submitting (server-checked), otherwise a clear message and a return to the missing question.
3. **Honest error messages.** The save error must distinguish "already submitted" (say "You already finished this
   survey" and go to done) from network errors; never blame the connection for a 409.
4. **Tests.** Unit test: rendering the done page never changes submission state; submit endpoint idempotent and
   refuses incomplete surveys. Playwright (production build via the existing config): open the last question, wait
   5 seconds (so prefetch has run), answer, finish, and check the answer is saved and the survey submitted exactly
   once; also the skip-then-last flow. Fr and en.
