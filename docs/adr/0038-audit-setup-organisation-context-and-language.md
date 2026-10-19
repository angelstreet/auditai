# 0038 - Audit set-up, organisation context, plain wording and language

- Status: Accepted
- Date: 2026-10-19
- Related: [0023](0023-auditor-auth-and-session.md), [0024](0024-i18n-fr-en.md), [0033](0033-invitations-tracking-reminders.md), [0035](0035-view-as-and-client-referent-surface.md), [0037](0037-intake-behind-sign-in-and-route-inventory.md); feedback items 4, 8, 9, 10, 12 and 15 in [TEST_FEEDBACK_2026-10-19](../TEST_FEEDBACK_2026-10-19.md)

## Context

Five test agents could not set an audit up: engagements and teams only existed as seed data, the expected
headcount stayed at 1, and nothing told a first-day auditor what to do. The header never named the organisation,
"Workspace" reset it, sign-in landed on the data page, screens showed internal words ("tenant", "Model route",
"PRD §10"), team names and statuses mixed languages, and the employee page could open in the wrong language.

## Decision

1. **Set-up lives in the admin.** Server actions in `app/admin/engagements/actions.ts` create and edit an
   engagement (name, language, opening and closing day, teams), launch it (draft or scheduled to live) and close it
   (live to closed), and create and rename teams with their size. The actor and tenant come from the session
   (`resolveActor`), so another organisation is refused and a view-as session is read only. Each write adds one
   `audit_log` row (`engagement.create|update|launch|close`, `team.create|update`) in the same transaction.
   Launch and close need the confirmation the dialog sends; a bare post is refused. Launch needs at least one team.
   A closed engagement is not edited.
2. **Headcount stays derived.** The expected headcount of an engagement is the sum of its teams' sizes. There is no
   second field to disagree with it; the form shows the total as the teams are ticked. Teams hang on the
   organisation's default department, created on first use.
3. **Engagement name** is a new nullable column. Pages show it, else the organisation name.
4. **New engagements reuse the questionnaire** of the organisation's latest engagement (or its newest version) and
   its privacy settings. Choosing among templates is a later product decision.
5. **Preview** renders the six survey questions in the engagement language from the same source as the respondent
   pages. It has no token and writes nothing.
6. **First-run guide** on the portfolio page: five steps (engagement, teams, links, progress, results), each icon
   plus word, each linking to its screen. Hidden once all five are done.
7. **Organisation context.** The chosen organisation is a preference in an `HttpOnly` cookie `evolai_org`, set by
   the middleware whenever a gated page is opened with `?tenant=<uuid>`; the same request also sees it through the
   `x-evolai-org` header the middleware sets (a client-sent copy is deleted first). `sessionTenantIds()` puts it
   first, so every `tenants[0]` fallback honours it. It is only an ordering hint: an organisation the session does
   not hold is ignored. The header names the organisation; the account menu lists the organisations to switch. The
   organisation is never silently reset.
8. **Landing** after sign-in is the portfolio (`/board`), and "Workspace" points there.
9. **Plain wording.** No "tenant", "locataire", raw id, "Model route", "smoke", "PRD", "Gate B", "pseudonym" or
   "Taux de réalisation" in either catalog. `packages/i18n/src/jargon.test.ts` reads every catalog string
   (placeholders stripped) and fails on those words. The privacy rule reads "Hidden under 5 people to protect
   privacy" once; the mascot tie-break moved to a help tooltip. French uses "avancement" for completion.
10. **Language.** Names typed by users are data and shown as written; helper `deName` elides French "de" before a
    vowel. The language menu calls a server action that sets the cookie and re-renders in the same round trip. The
    employee entry page uses, in order, the person's choice, the engagement language, then the browser; the first
    visit goes once through `/api/locale/init` to store it (open-redirect safe, loop-proof with `?l=1`). Dates use
    `Oct 19, 2026` and `19 oct. 2026`; statuses and kinds are translated everywhere.
11. **Data page.** Erasing a code that does not exist says so and writes nothing; erasing needs the code typed in
    the dialog (server checks it too). Exports have plain, translated column names and a download button.
12. **Links.** Link batches get a `batch_id` (migration 0021). A batch of the same size within ten minutes asks for
    a tick to confirm; a whole batch can be withdrawn at once. The link base URL is `APP_BASE_URL`, else
    `NEXT_PUBLIC_SITE_URL`, else the request host (https unless localhost).

## Alternatives considered

- A headcount field on the engagement: two numbers that can disagree; rejected.
- Organisation in the URL only: lost on every link without the query; rejected for a cookie plus query.
- Cookie set in a server component: not allowed in Next 14; the middleware is the one place that can.
- Banning words by hand review only: it regressed twice already; a test is cheaper.

## Consequences

- Migration **0021** must be applied to the live Neon database before deploy (`engagements.name`,
  `invitations.batch_id`, new audit verbs). The code reads `e.name`, so the page errors until it is applied.
- Existing e2e tests that erased a respondent or expected the data page after sign-in were updated.
- The team space copy ("Les liens de {team}") is owned by TASK-S; it can use `deName`.
