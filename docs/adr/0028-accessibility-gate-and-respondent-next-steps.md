# 0028 - Accessibility gate, respondent "what happens next" and contact (TASK-I)

- Status: Accepted
- Date: 2026-10-18
- Deciders: maintainers
- Related: [0024](0024-i18n-fr-en.md), [0025](0025-design-tokens.md), [0027](0027-one-font-and-playwright-in-ci.md), PRD §15, §16, [UX audit](../UX_AUDIT.md)

## Context

Accessibility was checked by eye. The done and return views gave one sentence about the next step and
no way to reach a human. Respondents cannot erase their own answers: erasure is an auditor action
by pseudonym (ADR 0020), so the screen must not imply self-service.

## Decision

1. **axe-core in Playwright** (`@axe-core/playwright`, dev dependency) scans respondent pages, login and
   the main admin pages, fr and en, at 360 and 1280. Serious or critical violations fail the suite.
   The same spec drives the whole respondent path with the keyboard only.
2. **Focus and landmarks**: a skip link, `main` is a focus target, a small client component moves focus
   to the page `h1` after each client navigation, and the quiz moves focus to each new question.
   Progress bars carry `aria-valuetext`. A global `prefers-reduced-motion` rule shortens motion.
3. **Contrast**: the wordmark "AI" and the progress fill use `--color-teal-ink` (text and indicator
   contrast); `tokens.test.ts` checks every text pair and the non-text pairs (focus ring, edges, progress).
4. **Next steps and contact**: the done and return view show three short steps and one contact line.
   The contact is `privacy_json.respondentContact` (optional, max 200 characters, free text), part of the
   engagement settings. It lives in the existing JSONB, so there is **no migration**. Without it the text
   says to ask the person who invited the respondent. No address is hard-coded.
5. **Deletion wording** says to ask the contact; it does not promise self-service erasure.
6. **French**: FR strings reviewed in place; typography and sentence length are tested; glossary in
   `docs/glossary-fr-en.md`.

## Alternatives

- A new `contact` column on `engagements`: cleaner to query, but a schema migration for one optional
  string; the JSONB already holds per-engagement settings.
- A self-service "delete my answers" button: needs a respondent-initiated erasure flow and an audit
  design that does not exist yet; promising it now would be wrong.

## Consequences

- New UI pages must pass axe in CI; new colours must pass the token tests.
- There is still no admin form to edit `respondentContact`; it is set in the engagement settings data
  until an engagement edit screen exists.
- Free-text contact is rendered as text, never as a link or HTML.
