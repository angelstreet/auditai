# UX and brand review (TASK-AC2, 2026-10-22)

What changed when the brand kit and the one standard chrome were applied. Decisions: [ADR 0048](adr/0048-brand-kit-tokens-and-contrast-rule.md).
Screenshots (synthetic "Demo Client" data only) are in `docs/brand/review/`: `before-*` from main before this work,
`after-*` from this branch, at 360, 768 and 1280, light and dark.

## What the owner complained about, and what is now true

| Complaint                                 | Now                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| Logo missing, or drawn twice              | Kit lockup in the header, once per page; the sign-in card has none                   |
| Header cluttered, links in several places | Logo left; FR \| EN, theme icon, sign-in or account right. Nothing else              |
| Language control not standard             | One MUI toggle group "FR \| EN", same on every page and on phones                    |
| Footer links repeated or missing          | One slim footer on every page: symbol, licence line, Privacy, Source (each once)     |
| Mascots on the first page                 | None on public or first-impression pages (style-guard enforces it)                   |
| Front page a site, with a dead-end button | One card: headline, one sentence, three steps, Contact us, Sign in, survey-link line |
| Sign-in explained who it was for          | Title, email, password, one button, Forgot password, survey-link line under the card |
| "Auditor" everywhere                      | "EvolAI" / "l'équipe EvolAI"; a test fails if the old words return in any message    |
| Account menu ragged                       | One left edge, fixed icon slot, one line per row (ellipsis + tooltip), fits 360 px   |

## Contrast

Teal `#19A999` fails AA as text on white and as a background for white text (about 2.9:1). Small text and links
use the darker teal token; filled buttons are white on the darker teal on light, ink on teal on dark. The token test
asserts both, and that raw teal on white stays below 4.5:1 so it is never used for text.

## Left for the next task (TASK-AD2)

Admin tabs, navigation entries, the missions home, answers and vocabulary on admin screens beyond the banned words.
The header still shows the current organisation next to the logo for staff (ADR 0038); AD2 decides whether it
moves into the mission page.

## TASK-AD2: missions home and the staff side cut down

Decisions: [ADR 0049](adr/0049-missions-home-and-parked-pipeline.md). Before: `after-admin-*` and
`after-account-menu-*` above (the AC2 state: portfolio landing, nine admin tabs). After: `ad2-after-*` in
`docs/brand/review/` (synthetic seed data, 360 and 1280, light and dark).

| Before                                                    | Now                                                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Sign-in landed on a portfolio board with a kanban         | Sign-in lands on Missions: one list, one next step per mission, one "New mission"               |
| Nine admin tabs, four vocabularies                        | Two entries: Missions and Settings; each mission has Overview, Links, Answers, Report, Settings |
| Analyses asked for an AI run with no button               | No analysis step: Answers shows the counts and the anonymised free texts, from five answers     |
| The Data tab could not export the answers                 | "Export CSV" on Answers (pseudonym, question, answer, time), refused under five                 |
| Publish refusal pointed at Analyses                       | It points only at "Write my own" under Actions                                                  |
| Test organisations next to a real client in the switcher  | Hidden unless the owner turns on "Show test data"                                               |
| Survey done page ended on "Optional: find your AI mascot" | It ends calm: team progress and what happens next                                               |
