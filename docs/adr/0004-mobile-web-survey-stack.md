# ADR 0004 \u2014 Mobile web survey stack

Status: proposed (2026-10-14). Created as part of M5 ([roadmap](../ROADMAP.md)).

## Context

PRD \u00a75, \u00a716 and FR-04 require a mobile web survey with a secure token, one question per screen, FR/EN, resume, and a 360 px acceptance test. M5 delivers the skeleton; Phase 2 replaces the in-memory store with Postgres-backed submissions.

## Decisions

- **Framework:** Next.js 14 App Router. Server Components render the welcome / question / done pages; a single small client island per page handles the locale toggle, answer selection and resume.
- **Token:** opaque base64url `reference.signature`, HMAC-SHA256 with `SURVEY_SIGNING_SECRET`. Verified with `timingSafeEqual`; defaults to a development secret so the demo boots without env wiring (a startup log reminds operators to override it).
- **State store:** process-local `Map<reference, SurveyState>`. Single submission per invitation is enforced. Resume works because the same URL returns the same state. Phase 2 swaps this for a Postgres row.
- **Persistence-free:** no database connection from the web app in M5. The Postgres schema from M4 is consumed by Phase 2 routes. Keeps the M5 deliverable deployable without a DB.
- **Synthetic template:** six scenario_choice questions covering the M3 calibration surface. Stored in source; a frozen questionnaire version will replace it in Phase 2.
- **Styling:** plain CSS (no Tailwind in M5). Single 360 px column, 44 px tap targets, WCAG 2.2 AA contrast, `aria-pressed` for option buttons. Fewer moving parts for the smallest acceptable mobile UI.
- **Routing:** `/` redirects to `/about`. `/about` mints a synthetic token at request time and links to `/s/[token]`. `/s/[token]` is the welcome screen with locale toggle, privacy notice and start button. `/s/[token]/q/[index]` renders one question; `/s/[token]/done` is the thank-you screen.
- **Tests:** vitest unit tests for `invitationToken` (sign/verify round-trip + tampering + malformed) and `surveyState` (create / record / submit / idempotent). Playwright at 360 px viewport asserts (a) no horizontal scroll, (b) option buttons fit the viewport, (c) invalid token returns 404, (d) two-question happy path.

## Alternatives

- **Tailwind:** faster prototyping but a heavyweight dependency for a six-question survey. Adopted in M6 or Phase 2 when the admin UI needs design tokens.
- **React Hook Form:** not needed yet; one question per page has a single controlled input.
- **Server Actions instead of /api routes:** the App Router supports them, but a thin JSON endpoint keeps the test surface small and matches how Phase 2 will talk to the database layer.
- **Native Expo app:** out of scope for Phase 1. PRD \u00a76.4 says native apps are only added after validated need.

## Consequences

- Every token-validating page must call `verifyInviteToken` before doing any work; the helper throws `InvalidInviteToken` so `notFound()` is consistent.
- The in-memory store does not survive a restart. Resume across instances requires Phase 2. The Playwright test relies on a single dev server and works because state lives in the same process.
- `SURVEY_SIGNING_SECRET` must be set in production; a future improvement is to refuse to boot if it is missing or matches the development default.