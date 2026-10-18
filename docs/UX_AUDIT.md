# UX audit — respondent path and visual consistency (TASK-E)

- Date: 2026-10-18
- Method: real app (`pnpm local:up`, synthetic data), driven headless with Playwright at 360×800
  (phone), 768 and 1280, in French and English. Persona: a busy employee with no technical vocabulary
  who leaves at the first confusing or long screen, then comes back later to ask "how is my team doing
  and what happens next?". Screenshots were kept outside the repo.
- Related: [ADR 0025](adr/0025-design-tokens.md) (tokens, type scale, style guard), PRD §4.2, §5, §15, §16.

## Top 10 findings, ranked by user impact

| #   | Finding (before)                                                                                                                                                                                                                                                                                                  | After                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Mixed languages.** A new submission always reported `en` to the page while the database stored the engagement language (`fr`). An English-browser respondent saw an English welcome, then French questions. A French-browser respondent saw a French header around an English welcome body.                     | The person's chosen language (header switcher, else browser language) is the survey language. It is written back to the submission, so every screen and the stored data match. One language switcher instead of two. Playwright checks each screen for words in the other language.                             |
| 2   | **Promises the app did not keep.** "You can skip any question" with no skip button. "About 6 to 8 minutes" for six one-tap questions, shown twice on the same screen (plus the question count three times).                                                                                                       | Every question has **Skip**. The time is stated once and is honest: "6 questions · about 2 min" (20 s per one-tap question, rounded up).                                                                                                                                                                        |
| 3   | **Return visit was a dead end.** "This survey has already been submitted" → a link to a thank-you page → "Review the survey" → back to "already submitted". Nothing about the team or what comes next.                                                                                                            | Done page and return visit show one glance: "Answers: 10 of 12" with a bar, one sentence on what happens next (open until 1 November / closed / summary shared), a tip, and the optional mascot quiz or the person's mascot. Counts only, no names or answers.                                                  |
| 4   | **Two taps per question.** Choose, then "Continue"; 13 taps for 6 questions. Grey disabled-looking "Finish" while saving.                                                                                                                                                                                         | Tapping an answer saves it and moves on: 7 taps for the whole survey (start + 6). "Saving…" is announced; a failed save keeps the answer selected and says "check your connection and tap again". Back keeps the earlier answer.                                                                                |
| 5   | **Welcome screen was a wall.** Title "EvolAI", a three-bullet privacy box with "pseudonym", "referent", "opportunities", then a "Language" block, then the button below the fold in French.                                                                                                                       | Plain title ("Your view on AI at work"), one-line purpose, duration, **one** Start button above the fold, one line on how it works, one privacy line ("Your name is not stored. Your company sees team totals, not your answers.") with the detail one tap away.                                                |
| 6   | **Quiz was a long technical form.** All five questions on one 2,000 px page, 13 px radio buttons, "tenant Synthetic tenant A", "Pseudonym: quiz-ww0j…", "raw score", "dominant mascot tier", not linked from the survey.                                                                                          | One question per screen with progress, whole-row 56 px answers, last tap shows the mascot. Offered from the done page as optional ("5 quick questions, about 1 minute"). The respondent quiz takes tenant and pseudonym from the signed link, never from the form. No internal identifiers on screen.           |
| 7   | **Jargon and long sentences** on respondent screens: pseudonym/pseudonyme, référent, opportunités, locataire/tenant, synthetic, "generative assistant", "source autoritaire" (calque), "classification", "déterministe".                                                                                          | Survey and quiz items rewritten in plain words, one idea each (synthetic content; codes and values unchanged). A banned-word list in `apps/web/e2e/respondent-ux.spec.ts` fails CI if jargon comes back on any respondent screen, in either language. French spacing uses non-breaking spaces before `? ! : ;`. |
| 8   | **Expired or withdrawn links were not handled.** An expired invitation still opened the survey; a malformed link showed the default English 404.                                                                                                                                                                  | "This link has expired" / "This link no longer works" + "Ask your team contact for a new link". The answer API refuses expired links (410) and changes after submission (409). A localised not-found page with the next action.                                                                                 |
| 9   | **Visual drift and leaks** (all surfaces): 17 hex colours in the web app (10 off-palette), 17 font sizes from 10 to 36 px, per-page `<style>` blocks in 11 files, four button looks. `/admin/data` turned every primary button red (the delete form's CSS leaked). Admin pages sat in a 360 px column at 1280 px. | One token file, one type scale, shared buttons/fields/cards/pills, no per-page CSS; the delete button alone is `.btn-danger`; dense pages use a 1,120 px column. See the token table below and ADR 0025.                                                                                                        |
| 10  | **Accessibility basics.** Header links 21 px tall; intake chips hid their checkbox with `display: none` (not reachable by keyboard); teal text and white-on-teal pills at 2.8–2.9:1; nested `<main>` on 9 pages and a second logo under the header on 17.                                                         | 44 px targets in the header and in every respondent control; chips keyboard-focusable; navy text on teal (5.0:1), teal text uses `--color-teal-ink` (5.2:1); one `<main>`, one logo. A unit test fails on any token pair under AA.                                                                              |

## Click count per respondent task

| Task                             | Before                                                                   | After                                                                        |
| -------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Open link → finish the survey    | 13 taps (Start + 2 × 6), button below the fold on phone FR               | **7 taps** (Start + 1 × 6), button above the fold                            |
| Skip a question                  | not possible (promised)                                                  | 1 tap                                                                        |
| Resume after an interruption     | Start → re-tap Continue on each answered question                        | 1 tap ("Continue where you left off" jumps to the first unanswered question) |
| Optional quiz                    | not reachable from the survey; 5 taps + scroll + Submit on one long page | 1 tap from the done page + **5 taps** (last one submits)                     |
| "How is my team doing?" (return) | no answer (dead end, 2 taps round trip)                                  | **0 taps**: shown on opening the link                                        |
| Read privacy detail              | always shown (3 bullets, 62 words)                                       | 1 line always; 1 tap for the detail                                          |

## Design tokens

Source: `packages/ui/src/tokens.css` (landing copy: `landing/brand/tokens.css`). Guarded by
`pnpm style-guard` (CI) and `packages/ui/src/tokens.test.ts`.

| Group      | Tokens                                                                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Palette    | `navy #172b3a` · `teal #19a999` · `blue #4a7fe8` · `amber #ffb86a` · `off-white #f7fafc` · `slate #536575` · `white` · `line #e3e8ee`                                                                                               |
| Derived    | `teal-ink #0f7a6e` (teal text, 5.2:1) · `border-strong #8796a5` (control edges, 3.0:1) · `danger #b42318` (6.6:1)                                                                                                                   |
| Roles      | `fg` navy · `muted` slate · `bg` white · `surface` off-white · `border` line · `accent` navy / `accent-fg` white · `highlight` teal / `on-highlight` navy                                                                           |
| Type       | `Inter`, system fallback · `xs` 12 · `sm` 14 · `base` 16 · `lg` 20 · `xl` 24 · `2xl` 32 · `3xl` 36–56 (landing hero) · weights 400/500/600 · leading 1.25/1.5                                                                       |
| Spacing    | 4 · 8 · 12 · 16 · 24 · 32 · 48 px                                                                                                                                                                                                   |
| Shape      | radius 4 / 8 / 12 / pill · shadow small / large                                                                                                                                                                                     |
| Layout     | tap target 44 px (answers 56 px) · narrow column 480 px (respondent) · wide column 1,120 px (admin, board, landing)                                                                                                                 |
| Components | `.btn` + `primary` / `secondary` / `danger` / `sm` · `.link-button` · `.card` / `.card-list` · `.field` + global input/select/textarea · `.chip` · `.pill-*` · `.dl-grid` · `.progress` · `.option-button` · `.step-bar` · `.stack` |

## What changed

- **Respondent flow** (`/s/[token]`, questions, done, return, quiz): items 1–8 above. New shared
  loader `apps/web/src/lib/respondent.ts` (token check, expiry/withdrawal gate, language sync, team
  counts); unit tests in `respondent.test.ts`.
- **Team view for a team member**: `/board` is the auditors' portfolio board and needs a sign-in, so it
  is not the employee's team view. The employee's team view is the status screen on their own link
  (team answer count, next step, team mascot when computed).
- **Design system**: tokens, shared classes, per-page CSS removed from admin, board, intake, welcome,
  login and data pages; landing pages load the shared tokens; logo colours from tokens.
- **Board**: the per-ticket pill that repeated the column name was removed (noise); ticket tone is a
  left border; columns stack 1 → 2 → 5 by width instead of a 5-column horizontal scroll on phones.
- **Tests**: `e2e/respondent-ux.spec.ts` (fr + en: banned jargon, one primary button, progress on
  every question, 44 px targets, no mixed language, ≤ 7 taps, quiz one-per-screen, return view, broken
  link); `mobile-survey.spec.ts` updated for one-tap answers; `m14-smoke` now asserts the pseudonym is
  **not** shown; `style-guard` and token contrast test in CI.
- **Smoke chain repaired**: since TASK-C made French the default, the milestone smokes (which
  assert English copy) failed; the shared smoke login now pins `evolai_locale=en`. The manual
  E2E workflow also passes `DATABASE_URL` to the smokes (it stopped at "DATABASE_URL is required").

## Deliberately left

- **Admin and consultant screens keep their vocabulary** (engagement, analysis, pseudonym, synergy):
  they are for trained users and are outside the jargon rule. They now share the tokens and components.
- **Header links (About, Privacy) on survey screens**: kept, they are small and expected; the survey
  has no other navigation to lose.
- **Archived mockups** (`landing/m12-mockup.html`, `landing/m14-quiz-mockup.html`) were deleted in
  TASK-G: unreferenced duplicates of the tokenised M12/M14 pages (ADR 0027).
- **Dark mode**: not in the MVP PRD. Semantic roles make it a later addition.
- **Quiz content** (five items, including one about AI coding help) is reworded but not re-scoped; it
  is the PRD's literacy calibration, and choosing items is a product decision.
- **Survey content** is the synthetic six-question template; real templates will come from the
  questionnaire versions in Postgres and need the same plain-words review.
- **Mascot artwork** keeps its own shading colours (exempt file); sizes vary by context on purpose.

## Owner decisions needed

1. **Privacy line wording.** Decided 2026-10-18: keep "Your company sees team totals, not your
   answers." as is, without "unless you are told otherwise".
2. **Derived colours**: `teal-ink #0f7a6e`, `border-strong #8796a5` and `danger #b42318`. Approved
   2026-10-18; they stay as tokens (see ADR 0025).
3. **Mascot names and descriptors** (Tortue/Renard/Chouette, now shorter and plainer) and the French
   tagline remain drafts for owner review (see ADR 0024). Deferred to the end, cosmetic.
4. **Survey and quiz wording** (FR and EN) was rewritten for plain language; please review the French
   in `apps/web/src/lib/syntheticTemplate.ts` and `packages/i18n/src/quizItems.ts`. French copy review:
   deferred to the end, cosmetic.
5. ~~**"What happens next" audience.**~~ Closed. Decision: audience-neutral wording, per the PRD's
   aggregate-by-default rule (managers get aggregate results, never individual answers). The sentences
   now say "a summary for the whole team, without names" (FR: "une synthèse pour toute l’équipe, sans
   noms"); the text lives only in the message catalogs.
