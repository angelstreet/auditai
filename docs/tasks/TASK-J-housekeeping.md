# TASK-J — Housekeeping: ROADMAP, ADR numbering, CODEOWNERS, smoke ids (model: haiku)

Start only after TASK-H and TASK-I are merged (they add ADRs and touch ROADMAP). Rebase first.

## Ground rules

- Public repo: no secrets, IPs, hostnames. Own worktree + branch. Merge to main yourself when gates pass (`format:check`, `lint`, `typecheck`, `test`, `leak-scan`, `style-guard`) and confirm main CI green. End with `STATUS: ...`.

## Do

1. **ROADMAP.md**: make it match reality. M11 and others show "queued" although merged: check `git log` and the code for each milestone and set the true status. Add the follow-up tasks A to I with PR numbers (`gh pr list --state merged`), a short "What is left" section (Gate B real-model run owner steps, Gate C SSO/MFA, production hosting and backups, invitations and reminders FR-03, real-device and screen-reader tests, Phase 2 and 3 items, mascot names and French copy deferred). Update README Status to match.
2. **Duplicate ADR number**: two files are numbered 0020. Renumber the later one to the next free number, fix every link to it (`git grep`), and add a one-line note at the top of the renamed ADR. Add a tiny script or test that fails on duplicate ADR numbers and run it in CI.
3. **CODEOWNERS**: `.github/CODEOWNERS` references `@auditai/maintainers`. Replace by the real owner: the GitHub user `@angelstreet` (the team does not exist). Keep the same path rules.
4. **Smoke scripts**: `SMOKE_AUDITOR_ID` fake actor remains in `apps/web/scripts/m10-smoke.mjs`, `m11`, `m13` and `services/ai/scripts/synergy-smoke.ts`. Make the smokes use the seeded test auditor user and a real session like the app does, so audit rows carry a real user id; keep them passing.
5. Remaining `git grep -i auditai` hits outside ADR history: list them in the ADR 0026 addendum with the reason (internal database identifiers kept on purpose), change any other.
