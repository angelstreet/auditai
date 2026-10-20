# 0046 — Questionnaire v1: free-text questions and neutral wording

Status: accepted

## Context

An acceptance test of the pilot survey found two problems in its content:

- It had only six short choice questions. The analysis groups free text into themes and drafts opportunities with
  verbatim citations; with choices only it produced neither, so no report could be published.
- The owner-facing wording read like an exam: hints such as "A good request says the goal, the audience and the
  format", "AI is not always the answer", two-option questions with an obvious right side, and an optional quiz that
  said "There is no wrong answer" and told some people "You are starting out".

## Decision

**The questions live in one versioned file**, `packages/contracts/src/questionnaires/pilot-v1.json` (validated by a
Zod schema in `questionnaire.ts` and a unit test). The survey pages, the apply script and the AI eval all read it.
The owner changes questions by editing that file; see `docs/RUNBOOK.md`, "Change the questions". A change of meaning
gets a new code and a new version (codes are never reused, as the contract already said).

**Content (French and English, plain words, about 7 minutes, 10 questions):**

- The six choice questions describe a situation and ask what the person usually does ("En général, que faites-vous
  quand..."). No hints, no judgement words. Every one ends with "Je ne sais pas / Ça dépend". That option
  (`unsure`) is never scored and does not lower the readiness score; skipped and free-text answers do not either
  (`packages/domain/src/scoring.ts`).
- Three optional free-text questions (`short_text`, at most 400 characters, live counter, the line "Pas de noms, ni
  e-mails, ni numéros : nous les masquons automatiquement."): the repetitive task that took the most time last week,
  the tool or information missing this week, and the one thing an assistant could help with. The text is
  anonymised before it is stored (ADR 0044). An empty box with Next is a saved skip (ADR 0045).
- One optional role question, **job area only**, as seven coarse categories with no free text. **Seniority is left
  out on purpose:** area plus seniority in a team of fewer than 5 people can point to one person. The area answer
  is stored but is only ever shown in groups of 5 or more (the engagement's existing minimum), and the question
  says so.

**Theme tags.** The analysis groups answers by the stored `axis`, and the database only allows `literacy`,
`practice`, `readiness`, `opportunity` and `context`. The three free-text questions therefore map: friction (the
repetitive task) to `practice`, tooling (the missing tool) to `readiness`, opportunity (the assistant wish) to
`opportunity`. The file keeps the reader's name in a `theme` field next to the stored `axis`. No migration was
needed and none is added. All three are `internal` sensitivity (the model path raises a run to `sensitive` when
redaction finds personal data, as before).

**Database.** `question_items` rows are created from the file, never edited once created:

- on first use, by the answer and skip routes (`apps/web/src/lib/questionItems.ts`), so a deployed questionnaire
  works with no manual step;
- by `pnpm questionnaire:apply --engagement-id <uuid>`, which also creates the `questionnaire_versions` row (found
  by a change-note marker, so it is idempotent) and points an engagement at it, refusing when the engagement already
  has submissions;
- by `pnpm seed:client`, which now seeds this questionnaire for a new client.

Item text is stored in French (the source language); the English text is only shown to respondents.

**Analysis.** The pipeline read the stored JSON of an answer (`{"kind":"short_text","text":...}`) as if it were the
answer. It now reads the person's words (the text, or the option label), ignores skipped questions, cites free text
word for word, and keeps free-text claims out of the rule-based contradiction check. `services/ai/eval/gold.json`
gains 13 synthetic respondents (French and English, built on the real question texts); `pnpm ai:eval` runs them on
the mock provider and CI fails on an ungrounded citation or a missed theme. No real model runs in CI.

**Quiz.** The optional mascot quiz keeps its questions and scoring. Its intro now says what it gives ("You get a
mascot, not a mark"), and the mascot descriptions describe a pace or a habit, never a level ("You explore AI at your
own pace", "AI is already part of your work"). A unit test scans the copy for judging words in both languages.

## Consequences

- Everything the analysis needs to produce themes and draft opportunities is now collected, but the quality of the
  themes depends on people writing a sentence; the three text boxes are optional.
- Choice answers of the old six questions (codes `synthetic_*`) stay as they are on engagements that already have
  answers. New questions use new codes (`v1_*`).
- **The French was written by an AI and needs one native read before the pilot** (question wording, the
  "Je ne sais pas / Ça dépend" option and the quiz copy). Edit `pilot-v1.json` and `packages/i18n/src/messages/fr.ts`;
  nothing else depends on the exact words.
- The `friction` and `tooling` themes are names in the file, not stored axes. If reports later need them as axes, a
  forward migration widens the `axis` check, and the file's `theme` values map one to one.
