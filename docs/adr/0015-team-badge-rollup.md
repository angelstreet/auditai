# 0015 - Team badge rollup + team profile (M14 slice C)

- Status: Accepted
- Date: 2026-10-17
- Deciders: maintainers
- Related: [0008](0008-auditor-review.md), [0010](0010-sponsor-onboarding.md), [0013](0013-quiz-badges-and-mascots.md), [0014](0014-quiz-form-and-result.md)

## Context

Slices A and B produced the `respondent_badges` table (one row per
submission, with the `is_current` partition) and the respondent-facing
quiz + mascot reveal. Slice C closes the loop:

1. A read surface the analyst can scan to see how the team's
   literacy clusters — without ever surfacing a raw score externally.
2. A worker that fills the `team_badges` table deterministically.

Both arrive in this PR.

## Decision

### 1. The rollup worker

`services/ai/src/teamBadgeRollup.ts` exposes `rollupTeamBadges(tenantId)`:

- For each team in the tenant, runs a SQL aggregate that joins the
  team's current `respondent_badges` rows via a synthetic invitation /
  engagement join (the rollup uses the existing relationship graph; no
  new column is added).
- Picks the modal mascot tier; ties resolve as `fox > owl > tortoise`
  (alphabetical-mascot, in confidence order).
- UPSERTs one `team_badges` row per team keyed on `team_id` (the unique
  constraint from migration `0011`).
- The worker is idempotent: re-running only updates `computed_at`.

The worker is pure — no external LLM, no per-team variation in cut
points, deterministic results.

Unit tests in `teamBadgeRollup.test.ts` lock in the tie-break and the
empty-team fallback (tortoise) so a future refactor cannot regress.

### 2. The CLI smoke

`services/ai/scripts/team-rollup-smoke.ts` prints
`teams=N upserted=M` and exits 0. The end-to-end smoke
(`pnpm m14:smoke`) wraps it and asserts `processed >= 1` after seeding
a fresh `respondent_badges` row mapped to the synthetic tenant team.

### 3. The contracts

`@auditai/contracts` adds `tierDescriptorFromType(tier): string`, a
duplication-free mirror of `@auditai/domain`'s `tierDescriptor` for the
web surface that imports only contracts. Same wording, one source of
truth in the contracts layer so it ships with the mascot tier enum.

### 4. The data layer

`apps/web/src/lib/teamBadgeData.ts` exposes:

- `listTeamBadges(tenantId)` ordered by `dominant_tier ASC, computed_at DESC`.
- `listTeamsInTenant(tenantId)` for the admin directory.
- `listAllTeamsAcrossTenants()` (service-account read) for the future
  M14.x board integration — not used yet.

Read helpers never traverse to `respondent_badges.quiz_score`, so the
team profile naturally never surfaces a raw number.

### 5. The page

`apps/web/src/app/admin/teams/page.tsx`:

- Server component scoped to the actor tenant.
- Renders one card per team with the dominant mascot tier pill + the
  per-tier composition (tortoise_count / fox_count / owl_count) + the
  `<Mascot>` SVG.
- Hard privacy rule: NO raw quiz_score on this surface. The smoke
  asserts the literal `\b88\b` does not appear in the rendered HTML.

### 6. The smoke

`apps/web/scripts/m14-smoke.mjs` is extended in place:

- Seeds a fresh current `owl-tier` badge mapped to the synthetic tenant
  team via a one-off invitation.
- Spawns `pnpm --filter @auditai/ai run team-rollup-smoke` and asserts
  `teams >= 1 upserted >= 1`.
- HTTP GET `/admin/teams?tenant=...` asserts the team card + tier pill
  render and the raw score is absent.
- Re-runs the worker to assert the row is updated, not duplicated.
- Cleans up its own rows + the `team_badges` row it created.

## Consequences

- The analyst / consultant / sponsor can scan the team's literacy tier
  in one column. Raw scores remain internal (the analyst reads
  `respondent_badges` directly when needed).
- The team rollup is reproducible: re-running the worker with the same
  input set produces the same `dominant_tier`.
- The mascot tier enum + the cut points + the tie-break order all live
  in one place (`@auditai/contracts` + the worker), so a future M14.x
  can swap deterministic for LLM-backed scoring without touching the
  data layer or the page.

## Alternatives considered

- **Show every respondent's mascot on the team page.** Rejected for the
  pilot: the page is the rollup. A future M14.x can add a per-respondent
  list inside a team card if the analyst needs it.
- **Materialise the rollup on every quiz write.** Rejected: it doubles
  the write surface and adds a failure mode. The worker is invoked on
  demand / on schedule.
- **Pick the median tier, not the modal one.** Rejected: modal is more
  intuitive for the team profile and matches the planned presentation.
- **Hard reset of `team_badges` on every run.** Rejected: the partial
  upsert preserves the team's history of computed_at runs.
