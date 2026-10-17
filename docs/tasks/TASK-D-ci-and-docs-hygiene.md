# TASK-D — CI gates and docs hygiene (model: haiku)

## Ground rules (read first)
- Repo: auditai (public: no secrets, IPs, hostnames, client names). Read AGENTS.md and the ADRs you touch. Use pnpm (`corepack pnpm`; put a `pnpm` shim on PATH if turbo cannot find it).
- Work in your OWN git worktree + branch (`git worktree add ~/auditai-<task> -b <task-branch> origin/main`). Never edit ~/auditai directly. Open a PR; do not merge other tasks work. Rebase on main before the PR.
- Gate before PR: `pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run leak-scan`, plus the relevant `pnpm mNN:smoke` after `pnpm local:up`. Report which gates you actually ran.
- Add a new ADR for each significant decision. Tests with every change.
- Owner autonomy rule from AGENTS.md applies. Ask only for credentials, money, real data, licence, irreversible actions.
- Context: a review of M15 (main @ 89ff7a8) found the items below. Other workers handle the other tasks in parallel (see docs/tasks/); keep to your scope and file set.
- End with `STATUS: done — ...` / `needs-owner: ...` / `blocked: ...`.

## Do
1. .github/workflows/ci.yml: add the coverage gate step (`pnpm coverage`, 80% threshold script already exists) and, if runtime is reasonable (<10 min) a job running `pnpm local:up` + `pnpm test:e2e` (embedded-postgres). If too slow, add it as a separate manually triggerable workflow_dispatch + nightly job.
2. docs/ROADMAP.md: add plain CI status badges (https://github.com/angelstreet/auditai/actions/workflows/ci.yml/badge.svg, same for leak-scan). No tokens are needed; remove the claim in docs that this needs a token.
3. Fix literal \u2014 / \u2019 escape sequences in docs/adr/*.md (e.g. 0016) and any other docs; render real characters. Run prettier.
4. scripts/deploy-contracts-map.sh: it needs a MiniMax-only tool and passes the token as a CLI argument (visible in ps). Add a header warning that it only works in that environment, read the token from env inside the tool call without printing it, and add a generic alternative section in docs (static hosting of landing/ via any provider) - no hostnames or secrets.
5. README Status: fix any statement that overstates FR-09 (erasure only covers respondent_badges today; TASK-B will fix) and note auth is not yet implemented (TASK-A).
## Out of scope
Application code under apps/ packages/ services/.
