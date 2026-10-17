# 0013 - Gamified literacy quiz + mascot badges (M14)

- Status: Accepted (slice A)
- Date: 2026-10-17
- Deciders: maintainers
- Related: [0006](0006-local-dev-runner.md), [0008](0008-auditor-review.md), [0009](0009-opportunity-register.md), [0010](0010-sponsor-onboarding.md), [0011](0011-cross-team-synergy.md)

## Context

Phase 2 closes with M14: the gamified literacy layer that turns the
analyses + opportunity stream into a respondent-facing showcase.
The hard rules from PRD \u00a76, \u00a79, \u00a715:

- The respondent sees a 3-tier mascot (Tortoise / Fox / Owl) \u2014 NEVER a
  raw 0\u201310 score, even on their personal result page.
- Teams and organisations aggregate to the same 3-tier mascot set. Raw
  numbers never appear externally.
- Mascots are inline SVG. No emoji. No external image.
- Pseudonym-only identity (`respondent_pseudonym`). No respondent FK.
- Retention aligns with the tenant's `retention_days`; the badge row
  carries `retention_at` so a future cleanup worker can purge.
- The auditor still sees the underlying `analyses` row; the badge is a
  presentation layer, not the source of truth.

The static mockup at https://w7jzvtg0dhdfg.space.minimax.io is the
design reference; the dynamic shape must match.

This ADR covers Slice A \u2014 the data model + mascot component +
contracts \u2014 and outlines the slice-B (quiz form + server action +
result reveal) and slice-C (team rollup worker + admin surface) plans.

## Decision

### 1. The data model (migration `0011_respondent_badges.sql`)

Two new tables, both tenant-scoped with the standard four-policy RLS
pattern (select / insert / update / delete, service-account fallback).

```
respondent_badges(
  id, tenant_id, respondent_pseudonym, engagement_id NULLABLE,
  quiz_score SMALLINT 1..100, mascot_tier ENUM,
  source_answers JSONB, is_current BOOL, assigned_at, retention_at,
  created_at, updated_at
)

team_badges(
  id, tenant_id, team_id UNIQUE, dominant_tier ENUM,
  member_count, tortoise_count, fox_count, owl_count,
  computed_at, created_at, updated_at
)
```

- **`respondent_badges`** is append-only at the row level: each quiz
  submission writes a new row with `is_current = TRUE`, and the
  previous "current" row for that pseudonym is flipped to
  `is_current = FALSE` in the same transaction. The team rollup
  counts only `is_current` rows.
- **`is_current` partial index** on `respondent_pseudonym` keeps the
  team-badge worker fast even after many quiz retakes.
- **`team_badges`** has `UNIQUE (team_id)` so the rollup worker can
  `INSERT ... ON CONFLICT (team_id) DO UPDATE` deterministically.
- **`retention_at`** mirrors the tenant's `retention_days`; a future
  cleanup worker can purge rows past their retention boundary.

### 2. The contracts

`@auditai/contracts` adds `respondentBadge.ts`:

- `mascotTierSchema` (enum 'tortoise' | 'fox' | 'owl').
- `quizScoreSchema` (smallint 1..100; Zod min/max).
- `quizAnswerSchema` (questionCode + value; no free-text).
- `mascotTierForScore(score): MascotTier` \u2014 the score \u2192 tier function
  lives in the contracts layer so the server action and the data
  layer agree byte-for-byte. Cut points: \u2264 50 tortoise, 51\u201380 fox,
  \u2265 81 owl.
- `respondentBadgeSchema` + `respondentBadgeWriteSchema` (wire / write
  shapes).
- `teamBadgeSchema` (the rollup wire shape).
- 7 new tests in `respondentBadge.test.ts`.

### 3. The mascot SVGs (`@auditai/ui`)

`packages/ui/src/mascots.tsx` exposes a single `Mascot` React component
that renders one of three inline SVGs depending on the tier:

- **Tortoise** \u2014 navy shell, teal accents, slow and steady.
- **Fox** \u2014 amber body, white belly, pragmatic learner.
- **Owl** \u2014 teal body, white eye discs, the engaged practitioner.

Rules:

- No emoji anywhere (a test asserts this character-class).
- No `<img>` tag and no external URL (a test asserts both).
- The component takes `tier`, optional `size`, optional `label`, optional
  `className`. Everything else is internal.
- The JSX compiles inside `@auditai/ui` because the package is now
  React-capable: `react`, `react-dom`, and the matching types are added
  to `devDependencies` (consistent with how the rest of the monorepo
  uses React for shared components).

### 4. What's NOT in Slice A

This slice ships the schema + the mascot assets. Slice B adds:

- The respondent-facing `/quiz` form (5\u20136 questions, all multiple
  choice, no free-text).
- The `submitQuiz` server action that validates the answers, computes
  the score, writes the `respondent_badges` row, and reveals the
  mascot on `/quiz/result`.
- An updated `audit_log` action (`badge.assign`) on the analyst trail
  (deferred to Slice B because the action verb is the new piece).

Slice C adds:

- The `computeTeamBadges(tenantId)` worker in `services/ai` that
  rolls each team's current badges into the modal tier (with
  alphabetical tie-break: tortoise < fox < owl).
- The admin/team profile page that surfaces the dominant mascot.

Each lands behind its own PR.

## Consequences

- The auditor can still see the raw score on the row; the
  respondent-facing surfaces only ever show the mascot.
- A respondent retaking the quiz writes a new row and demotes the
  previous one to `is_current = FALSE`, so the history is preserved
  for retrospective analysis without polluting the rollup.
- The mascot assets ship with `@auditai/ui`, so any consumer
  (admin pages, board, future reports) draws from the same source.
- No commitment to a real LLM-backed quiz scoring yet: Slice B's
  scoring is deterministic and explainable. A future M14.x can swap
  the `submitQuiz` scorer for an LLM-backed version that still writes
  the same row shape.

## Alternatives considered

- **Single-tier badge (e.g. just Fox).** Rejected: three tiers give the
  team profile real signal without exposing raw numbers, and lets the
  respondent feel movement over time.
- **Hardcoded team score.** Rejected: teams must derive their
  dominant tier from the underlying rows. A frozen column would hide
  the freshness of the rollup.
- **External mascot images.** Rejected: the PRD mandates inline SVG.
  External assets also break the privacy posture (a CDN request from
  an auditor device could leak the engagement).
- **Map the badge to an `opportunity` row.** Rejected: a badge is not
  an opportunity. Conflating them makes the M11 status graph noisy.
- **Store the mascot image bytes in the DB.** Rejected: inline SVG in
  the component is simpler, version-controlled, and audited in the
  same PR as the schema change.
