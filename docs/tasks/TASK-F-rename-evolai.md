# TASK-F — Rename the project to EvolAI everywhere (model: sonnet)

The GitHub repo is already renamed to `angelstreet/evolai` (old URLs redirect; remotes updated). Finish the rename inside the code. Start only after TASK-E is merged on main (it edits the same UI files); rebase first.

## Ground rules

- Public repo: no secrets, IPs, hostnames. Own worktree + branch; owner rule: merge to main yourself when gates pass (`format:check`, `lint`, `typecheck`, `test`, `leak-scan`, smokes, Playwright), confirm main CI green. ADR for the decisions. End with `STATUS: ...`.

## Do

1. Product name is **EvolAI** (see docs/EvolAI_Branding_Guide.md if present). Replace the working name "AuditAI/auditai" in user-visible text (both FR and EN catalogs), page titles, README, docs, landing pages, ADR prose (keep ADR history readable: add a note, do not rewrite past decisions), `angelstreet/auditai` URLs and CI badges.
2. Package scope `@auditai/*` -> `@evolai/*` (package.json names, imports, tsconfig paths, turbo, vitest configs, lockfile via `pnpm install`). Update the root package name and docker/compose service and image names.
3. Database: do NOT rename live roles/databases blindly. Decide in the ADR: rename the app role and default db via a new forward migration (never edit old migrations) or keep the internal identifier with a comment. Whatever you choose, local:up, docker compose, CI and every smoke must still pass, and env var names stay documented. Keep backward-compatible fallback for existing `DATABASE_*` env values.
4. Cookie/session names, storage keys, and locale cookie: rename with a one-time fallback read so existing sessions are not logged out in a surprising way (or document the forced re-login).
5. Leak scan allowlist and scripts: update terms. Make sure `git grep -i auditai` leaves only intentional hits (ADR history note, migration history, redirect note); list them in the ADR.
6. Do not move or rename folders on codebox or the Mac; the owner does that after merge.
