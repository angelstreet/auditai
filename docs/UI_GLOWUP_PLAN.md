# UI glow-up plan (TASK-L)

Plan for the owner's second live review. The rules are [UI_RULES.md](UI_RULES.md) §0-13; the decisions
are in [ADR 0034](adr/0034-mui-theme-and-standard-chrome.md). The screenshots come from
`apps/web/e2e/screens.spec.ts` (`SCREENS=1`, kept out of git): every page in light and dark, at 360 and
1280, in fr and en.

## 1. Defects found, ranked by user impact

| #   | Where                                | Defect (rule)                                                                                                                             | Impact                                                  |
| --- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | every admin page                     | No identity after sign-in: no name, role or organisation, and no sign-out (§11)                                                           | The auditor cannot tell whose session or tenant this is |
| 2   | every page, dark                     | No real dark scheme: a near-black page in the browser's dark mode, a navy primary button on near-black, and a navy logo on dark (§1, §12) | Main action nearly invisible                            |
| 3   | header, all pages                    | Language is two text buttons, and the header wraps to 2 rows at 360 (§0, §5, §6)                                                          | Looks hand-made; the width changes with the language    |
| 4   | /welcome                             | 3-line headline, a capitals eyebrow pill, 3-line step cards, the button glued to the last card, no visual or footer (§13)                 | First impression: "a document, not a product"           |
| 5   | /login                               | Plain inputs, no show/hide password, navy button, title says "auditor" (§0, §3)                                                           | Feels unsafe and unfinished                             |
| 6   | admin data, synergies, teams, intake | Developer copy on screen: "tranche B de M15", "exigence FR-09", "Locataire Synthetic tenant A", "RFC 4180" (§8, §13)                      | Unprofessional, confusing                               |
| 7   | admin data                           | Two filled buttons (export and erase), and a filled red erase outside a confirm dialog (§3)                                               | Risk of a mis-click on an irreversible action           |
| 8   | admin nav                            | Section links are outlined buttons with arrows, and the current section is not marked (§5, §11)                                           | Users get lost                                          |
| 9   | respondent start, done, return       | Navy primary, the privacy line is plain text, the progress card has no icon or status word (§3, §4)                                       | Weaker trust and less clear status                      |
| 10  | questions                            | Option buttons look like plain boxes; the progress bar is thin and has no step count beside it (§3, §5)                                   | Slower to answer                                        |
| 11  | quiz, quiz result                    | Same as above, and no clear next step on "result missing"                                                                                 | Dead end                                                |
| 12  | intake                               | Native selects and sliders, the submit button glued to the card, the side summary repeats help text (§0, §13)                             | Long and tiring form                                    |
| 13  | 404, broken link                     | Bare text, no icon, no way back (§4)                                                                                                      | Dead end                                                |
| 14  | footer                               | None (§13)                                                                                                                                | No trust line, no legal links                           |

## 2. Per page: before → after intent

- **Header (all pages).** Before: logo, two text links, two language buttons, wrapping to 2 rows at 360.
  After: one 64 px row with the logo, About and Privacy as links (hover underline, current page marked), a
  globe icon menu, a sun/moon icon, and an account control. Signed out, the account control is a sign-in
  icon. Signed in, it shows the initials avatar and the name, and opens a menu with name, email, role,
  organisation, switch organisation, workspace and sign out. On phones the links fold into a hamburger.
  Every control is 44 px with a tooltip and an aria-label, and keeps the same box in fr and en.
- **Footer (all pages).** A hairline, then the logo mark, the trust line ("Open source, Apache 2.0") and
  About, Privacy and Source links.
- **/welcome.** Before: a pill, a 3-line h1, a long lede, four 3-line cards, the button glued below them.
  After:
  - Hero, two columns at 1280 and one at 360. Left: a 2-line headline ("Find where AI really helps your
    teams"), a one-line subtitle, one primary button ("Start the intake") and one secondary link ("How it
    works"). Right: a visual, the existing mascot set on a soft surface.
  - Four benefit tiles: an icon tile, a title and one line each (scene, listen, review, act).
  - A trust line with the privacy icon ("We never ask for names. A person reviews every finding."; respondents are stored under a pseudonym only, staff accounts do hold a display name, so "no names stored" would not be true), then the
    footer.
- **/login.** A centred card (max 400 px) with the logo mark, the title "Sign in", MUI text fields with
  labels (email with `autocomplete=username`, password with an eye toggle), an inline error above the
  form, one full-width teal button with a loading state, and a "Privacy" link under the card.
- **Respondent start.** A card with the title, a one-line subtitle, an "N questions · about M min" line
  with a clock icon, one teal "Start" button, and privacy as one line with a shield icon that expands
  (details). Continue-where-you-left-off keeps the same layout.
- **Question screens.** A "Question i of n" caption plus a thicker progress bar always at the top, the
  prompt (2 lines max), big option buttons (outlined, 56 px, full width, selected = teal edge plus a
  check icon) and a back link. One tap per question is unchanged.
- **Done and return.** A success icon with the title, a team-progress card ("6 of 12 answered" with a
  progress bar and status text), "what happens next" as a 3-step list with icons, the optional quiz card
  with the single teal button, and the tip as a quiet card.
- **Quiz.** The same as the question screens. Result: the mascot visual, its name, one line, and a
  "Take again" text button. Missing result: an empty state with one button.
- **Admin (engagements, teams, synergies, data, analyses, opportunities).** `PageTitle` with a one-line
  plain subtitle, admin section tabs (Portfolio, Teams, Synergies, Data) marking the current one, key
  numbers as `StatTiles`, lists in one bordered container, status as `StatusText`. On the data page:
  export is the one primary action; erase is an outlined danger button opening a `ConfirmDialog`.
- **Intake.** MUI fields, chips as toggle chips, selects as MUI Select, the save button 24 px under the
  last card, and the summary card trimmed to one line.
- **404 and broken link.** An `EmptyState` with the broken-link icon, one line, and a button home (404) or
  "ask your team contact" text (broken link).

## 3. Components (packages/ui)

`theme` (light and dark CSS-variable schemes), `AppIcon` and the icon registry, `PageTitle`, `IconTile`,
`StatTiles`, `StatusText`, `SettingRow`, `EmptyState`, `SegmentedToggle`, `ConfirmDialog`,
`NotifyProvider` and `useNotify` (snackbar), `SkeletonRows`. In apps/web: `SiteHeader` (with
`LanguageMenu`, `ThemeToggle`, `AccountMenu`, `NavMenu`), `SiteFooter`, `AppProviders` (emotion cache,
theme, baseline).

## 4. Copy cuts

| Where           | Before                                                             | After                                                           |
| --------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| welcome eyebrow | "AUDIT D'ADOPTION DE L'IA"                                         | removed                                                         |
| welcome h1      | "See how work really happens. Build confidence with AI." (3 lines) | "Find where AI really helps your teams"                         |
| welcome lede    | 2 sentences                                                        | "Employees share how they work. A person checks every finding." |
| step cards      | 2-line bodies                                                      | one line each, e.g. "Goals, budget and limits."                 |
| login title     | "Auditor sign-in"                                                  | "Sign in"                                                       |
| admin subtitles | "Tenant Synthetic tenant A. M15 slice B covers requirement FR-09…" | "Export tables and erase a respondent's data."                  |
| synergies       | 2-sentence detector explanation                                    | "Themes that come up in two or more teams."                     |
| intake          | "Tenant … This form saves a new sponsor record…"                   | "Goals, budget and limits for this organisation."               |

## 5. Lifted dark palette (UI_RULES §12)

| Role               | Light     | Dark      | Check                   |
| ------------------ | --------- | --------- | ----------------------- |
| page               | `#f7fafc` | `#1a1d23` |                         |
| card / menu        | `#ffffff` | `#262a33` | one step lighter        |
| raised, hover      | `#eef3f7` | `#2f3440` |                         |
| text               | `#172b3a` | `#e8ebf0` | 14.1:1 on the dark page |
| muted              | `#536575` | `#a0a8b5` | 6.0:1 on the dark card  |
| hairline           | `#e3e8ee` | `#363c48` | decorative              |
| control edge       | `#8796a5` | `#7a8494` | 3:1 or more             |
| primary fill       | `#0f7a6e` | `#2ec4b2` | teal in both schemes    |
| on primary         | `#ffffff` | `#172b3a` | 5.2:1 and 6.7:1         |
| link / accent text | `#0f7a6e` | `#5ad1c2` |                         |
| focus              | `#4a7fe8` | `#7fa8f5` |                         |

All pairs are asserted in `packages/ui/src/tokens.test.ts`.

## 6. Order of merges (each one deployed, re-shot and checked READY)

1. MUI theme, light and dark palette, icon registry, header with the identity menu, footer; the welcome
   page rebuilt.
2. Login page.
3. Respondent flow: start, questions, done, return, quiz, 404 and broken link.
4. Admin: section tabs, page titles, data page danger flow, copy cuts; intake and board.
5. Style-guard extension (icon imports, emoji, `contained` count, button colours); header bounding-box
   test across locales and themes; docs (README, AGENTS.md, HANDOVER.md, UX_AUDIT.md change log).
