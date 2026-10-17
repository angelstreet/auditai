# 0014 - Quiz form + result reveal (M14 slice B)

- Status: Accepted
- Date: 2026-10-17
- Deciders: maintainers
- Related: [0005](0005-admin-data.md), [0010](0010-sponsor-onboarding.md), [0013](0013-quiz-badges-and-mascots.md)

## Context

Slice A put the `respondent_badges` and `team_badges` tables in place,
plus the inline-SVG mascot component in `@auditai/ui`. The
respondent-facing form + result page are the missing UX. Slice B
ships them with a deterministic scorer and an audited re-take flow.

## Decision

### 1. Quiz config in `@auditai/domain`

`packages/domain/src/literacyQuiz.ts` exposes:

- `LITERACY_QUIZ`: the canonical five-question config with stable
  question codes (`ai_last_30d`, `ai_media_consumption`,
  `ai_chatbot_use`, `ai_assisted_coding`, `ai_built_projects`). Each
  question carries 3-4 multiple-choice options with `weight` (0..22).
- `computeQuizScore(answers): number` — sums the weights and
  normalises to 1..100 so the `mascotTierForScore` cut points (≤ 50
  tortoise / 51..80 fox / ≥ 81 owl) hold regardless of the question set.
- `isCompleteQuizSubmission(answers): boolean` — the server action
  refuses partial submissions.
- `tierDescriptor(tier): string` — the one-line FR description shown
  on the result page.
- `generateQuizPseudonym(): string` — lowercase `quiz-xxxxxxxx-yyyy`.

7 new tests in `literacyQuiz.test.ts`.

### 2. The data layer

`apps/web/src/lib/respondentBadgeData.ts`:

- `writeRespondentBadge(tenantId, payload)` — validates the payload,
  computes the tier centrally, demotes the previous current row for
  that pseudonym, and writes the new `is_current = TRUE` row. The
  demotion + insert run in one `withTenant` transaction so a partial
  failure leaves no loose ends.
- `getCurrentBadgeForPseudonym(tenantId, pseudonym)` — returns the
  single current row, or `null`. The respondent result page reads
  through this helper.

The page intentionally never reads `quiz_score` back to the client.
The score lives on the row for the analyst; the respondent sees only
the mascot.

### 3. The pages

`apps/web/src/app/quiz/page.tsx` is a server component that:

- Resolves the actor tenant from `?tenant=<uuid>` (matches the rest
  of the admin surface).
- Mints a fresh pseudonym server-side if the user lands without one
  (?pseudonym).
- Renders the five questions and posts to `submitQuizAction`.

`apps/web/src/app/quiz/QuizForm.tsx` is the client form: one
`<fieldset>` per question, a `useFormState` action, the standard
`Save…` pending button. Pseudonym and tenant are hidden inputs.

`apps/web/src/app/quiz/actions.ts` validates every answer, computes
the score, calls `writeRespondentBadge`, and `redirect`s to
`/quiz/result?pseudonym=...&tier=<computed>`.

`apps/web/src/app/quiz/result/page.tsx`:

- Reads `getCurrentBadgeForPseudonym`. If the row is missing, falls
  back to the `?tier=...` hint. Never trusts an unknown tier.
- Renders the `<Mascot>` (Tortoise / Fox / Owl) from `@auditai/ui`.
- Shows the tier descriptor and a sidebar listing all three tiers.
  The current tier is highlighted.
- **NEVER** renders `quiz_score` to the respondent. The smoke asserts
  the regex `\\b88\\b` does not match the response HTML.

### 4. The smoke

`apps/web/scripts/m14-smoke.mjs`:

- `GET /quiz` asserts the five canonical question codes render and
  the option values are present.
- Mirrors the server action via SQL: writes one row at score 88
  (owl tier) for a fresh pseudonym.
- `GET /quiz/result` asserts the owl tier class renders and the
  raw score is absent (privacy regression check).
- Mirrors a re-take at score 40 (tortoise): the previous row is
  demoted to `is_current = FALSE` and a new `is_current = TRUE` row
  is inserted. History is preserved (2 rows total).
- Asserts the result page renders Tortoise and neither raw score.
- Cleans up.

### 5. Privacy + retention

- The respondent only ever sees the mascot and the tier descriptor.
  The smoke fails the build if the raw quiz score leaks into the
  respondent HTML.
- The respondent identity is the platform-issued pseudonym; no
  respondent FK, no email, no name.
- `retention_at` mirrors the tenant's `retention_days`; a future
  cleanup worker can purge.

## Consequences

- The end-to-end loop closes for the respondent: pseudonym →
  submit → mascot. Five-question quiz + deterministic scorer.
- A respondent retaking the quiz preserves history (`is_current`
  partition) so retrospective analysis still works without polluting
  the team rollup.
- The result page URL is signed with the tier in the query string,
  but the page trusts the row, not the URL: a tampered tier is
  caught (the row's `mascot_tier` wins, and a missing row falls
  back to a friendly "we can't find that result" message).
- `@auditai/ui` is now a real React component package; the
  `react`/`react-dom` deps land cleanly inside the workspace.

## Alternatives considered

- **LLM-backed quiz scoring.** Rejected for the pilot: deterministic
  scoring is explainable and auditable. The shape on the row is the
  same regardless, so a future M14.x can swap the scorer for an
  LLM-backed implementation without schema change.
- **Store the question-answer trace in the row.** Done: the
  `source_answers JSONB` captures every `(questionCode, value)`
  pair so the auditor can audit what was answered. No free-text is
  ever captured (the JSONB shape enforces it).
- **Cookie-based respondent session.** Rejected: pseudonyms are
  query-string parameters so the system stays accessible to
  share-links and stateless PWA-like experiences.
- **Hard delete on re-take.** Rejected: the partial index on
  `is_current` makes the re-take flow essentially free at the
  rollup layer; history is preserved.
