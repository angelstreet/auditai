# 0049 — Missions home, five mission tabs, two navigation entries, and the parked analysis pipeline

Status: accepted

## Context

The independent review (`docs/FABLE_REVIEW_2026-10-22.md` §1, §3 to §6) found the staff side to be a generic admin
around a pipeline that cannot run: the first screen after sign-in was a portfolio board with a kanban, a checklist
and a sponsor-brief count; nine admin tabs mixed four vocabularies; the Analyses page asked for an AI run that has
no button and no approved model route; the Data tab could not export the answers the runbook promised; the survey
done page ended on a mascot quiz. The consultant's real need is a pre-visit brief: per team, how many answered, how
each choice question was answered, the role mix and the free texts, with groups under five hidden.

## Decision

- **Home = Missions** (`/admin/engagements`). Sign-in, set-password and `/board` land there. One list (MUI table on
  desktop, cards on a phone) over every organisation the person works for: client, status as icon plus word
  (Draft, Open, Closed, Report published), answers "6 of 12" or "Hidden until 5 answers", closing date, and the one
  next step (Create links, Follow answers, Read the brief, Write the report). One page action: New mission. The
  status and next step are a pure rule (`apps/web/src/lib/missionStatus.ts`) with unit tests.
- **Mission page** (`/admin/engagements/<id>`, a layout): client name, status, the next-step button (filled only on
  Overview, hidden on the tab it opens), then the tabs **Overview, Links, Answers, Report, Settings**.
  - Overview is the pre-visit brief: counts before five answers; from five answers per team, one horizontal bar chart
    per choice question (plain boxes coloured from the theme), the role mix and a link to the free texts; printable.
  - Answers: counts per choice and anonymised free texts by question, no link to a person, only from five answers;
    "Export CSV" (pseudonym, question code, question, answer, comment, time) with formula neutralisation, refused
    below five with a plain sentence, one audit row with counts only. Staff only: the staff guard sends a referent
    or a view-as session to `/client`, and the CSV route checks the same (`mayReadAnswers`).
  - Report is the existing editor; Settings holds dates, teams and sizes, language and preview, privacy notice and
    names to hide.
- **Top navigation = Missions, Settings** plus the account menu. Workspace Settings has Members (referents and their
  sign-in links, the owner's "Show test data"), Data and erasure, and the Audit trail.
- **Removed from the UI, data kept, old URLs redirect** (`lib/legacyRoute.ts`, keeps `?tenant=` only when it is a
  well-formed id): portfolio board and kanban, intake, Synergies, Data, Teams, Names to hide and Audit trail as
  tabs, Analyses and Opportunities (redirect to the Report tab), the mascot quiz card on the done page.
- **Test data hidden**: organisations whose slug starts with `synthetic-` are left out of the missions list and the
  organisation menu, and sorted last as the default organisation, unless the owner turns on "Show test data" (an
  http-only cookie). A person who has only test organisations still sees them, so local runs and tests work.
- **The analysis pipeline is parked**: no button, no cron, no screen. The worker code and tables stay. Publishing a
  report with no accepted finding points only at "Write my own" under Actions.

## Alternatives

- Keep the kanban as an optional view: rejected, four vocabularies and no consultant need.
- A run-analysis button (the TASK-AA branch): rejected for the MVP; no approved route, never run on real data, and
  sixty lines of free text are read faster by a person. Revisit after three real missions.
- Hide test organisations by deleting them, or by a database flag: rejected, the seed naming is enough and no
  migration is needed for an MVP.
- Answers export as a new kind of the generic export table: rejected, it needs a migration of the kind check and
  the export screen is gone; the per-mission CSV route is simpler and audited.

## Consequences

- Specs follow the new routes; `missions.spec.ts` covers the landing, the tabs, the redirects, the nav at three
  widths and the referent refusal. The AI-draft analysis spec is removed with its screen.
- The unused analysis, opportunity, synergy and intake server actions remain, guarded as before, until the pipeline
  question is reopened.
