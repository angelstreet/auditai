# Independent review (Fable, 2026-10-22)

Answers to section 4 of [FABLE_REVIEW_HANDOVER.md](FABLE_REVIEW_HANDOVER.md). Sources: the handover,
AUDIT_WORKFLOW.md, UI_RULES.md, the brand board, the live front page, sign-in and About pages, and the live
screenshots of the 2026-10-22 acceptance test (signed-in home, mission, account menu, referent view on desktop and
phone, the ten-question survey on a phone). No code was changed.

## Verdict in three lines

The client side (referent page, survey on a phone) is good and should be left alone except for wording. The
staff side is a generic SaaS admin wrapped around a pipeline that cannot run. The fix is not more features: cut
the staff side down to Missions, Answers and Report, apply the brand kit, and read the answers by hand.

## 1. Framing

Yes: EvolAI is the consultancy's intake tool. The product promise is "arrive on site already knowing the team".
The minimum that delivers it:

1. A mission: client, one or more teams with headcount, opening and closing dates, questionnaire language.
2. Links the referent sends, with a ready-made message. (Exists, 8/10.)
3. Employees answer ten questions on a phone in seven minutes. (Exists, 8/10.)
4. **A pre-visit brief the consultant can read**: per team, response rate, the distribution of each choice
   question, the free-text answers listed by question, the role mix. Groups under five stay hidden. This is
   the deliverable that is missing today, and it is a read-only page plus a CSV, not an AI pipeline.
5. After the visit, the report (score, actions, 30/60/90 plan, PDF). (Exists.)

Everything else is not MVP: AI themes and contradictions, synergies, opportunity scoring, sponsor briefs, the
kanban, the intake, badges, the mascot quiz, the audit-trail screen, the data tab, the names-to-hide tab.

## 2. Front page and sign-in

Who arrives: (a) an employee who typed the domain instead of opening their link, (b) a referent or sponsor
checking who EvolAI is, (c) a prospect, rarely, (d) staff. The page must serve (a) and (b) in one screen and
send (d) to sign-in. It is a card, not a site. No mascots, no "Start the intake" (it leads to a login today: a
trap), no trust line, no four-step grid.

Front page, one screen:

- Header: kit lockup left; FR | EN, theme icon, sign-in icon right.
- Headline EN: **"See how your teams really work with AI."** FR: **"Voyez comment vos équipes travaillent vraiment avec l'IA."**
- One sentence EN: "EvolAI helps organisations find where AI already helps, where it is risky, and what to do
  next. A short anonymous survey, then a visit and a plan." FR: "EvolAI aide les organisations à voir où l'IA
  aide déjà, où elle est risquée et quoi faire ensuite. Un court questionnaire anonyme, puis une visite et un plan."
- Three steps echoing the symbol (apricot, blue, teal):
  Understand / Comprendre: "Your teams answer ten questions, anonymously, in seven minutes."
  Adapt / Adapter: "We come on site with the picture already clear and work with your teams."
  Evolve / Évoluer: "You get a readiness score, prioritised actions and a 30/60/90-day plan."
- One primary button: **Contact us** (mailto or the owner's form). One secondary text link: **Sign in**.
- One quiet line for case (a): "Received a survey link? Open it from the message you got. No account needed."
- Footer, once: symbol · "© EvolAI · Open source, Apache 2.0" · About · Privacy · Source.

Sign-in page: header as above, a left-aligned card with the title "Sign in", email, password with the eye icon,
one filled button, "Forgot password?". No logo in the card, no help sentence about auditors, no privacy link
under the form. One line under the card, same as the front page: "Received a survey link? Open it from your
message." That line is the only help text that earns its place, because employees do land here.

About page: today it is a leftover ("by invitation"). Drop it; the front page is the About. Privacy stays as a
page, linked once in the footer.

## 3. Information architecture for staff

"Missions list → mission page with Overview, Invitations, Answers, Report, Settings" is right. Two amendments:

- **Overview is the pre-visit brief**, not a checklist. Before answers exist it shows the one next step. Once
  five answers exist it shows, per team: answers "12 of 24", closing date, one bar chart per choice question,
  the role mix, and a link to the free-text list in Answers. That is what the consultant prints before the visit.
- **Top navigation is two entries plus the account menu**: Missions, Settings (members, retention, erasure,
  audit trail). "Reports" is a tab inside the mission, not a top-level entry: a consultant thinks in missions.

Teams and names-to-hide live in the mission's Settings tab. Test organisations are hidden unless the owner
toggles "Show test data". The account menu says "EvolAI team · <client>" and lists organisations only, never
person names.

## 4. The analysis step

**By hand, from the Answers tab and a CSV. No button, no cron, for the MVP.** The questionnaire is six choice
questions, three free texts and a role; a team of twenty produces about sixty lines of free text. A consultant
reads that in fifteen minutes and knows more than any theme extractor would tell them. The pipeline has not run
on real data, needs an approved route that does not exist, and has absorbed most of the build time. Park it.
Revisit after three real missions, when the consultants can say what they actually want summarised.

The smallest usable insight is therefore: counts per choice per question per team, free texts by question,
both gated at five answers, both exportable as CSV. That is finding 3 of the acceptance test and item 3 of the
TASK-AA brief, nothing more.

## 5. Blocking versus noise, and what to cut

MVP-blocking (in order): 18 and 20 together (replace "run analysis" with the Answers view and export), 19
(publish refusal wording), 11 (signed-in home), 9 ("auditor" everywhere), 3 and 4 (brand kit, no mascots),
12 (test organisations in the live switcher; a real client sits next to "Synthetic tenant A"), 21 (dates),
22 (link host fallback), 7 and 6 (sign-in and chrome).

Small polish, do inside the same tasks: 5, 8, 10, 23.

Noise or already handled: 1, 2 (re-check only), 13 (native French read: do it once, at the end, on the final
strings), 14 (stay parked), 15, 16, 17, 24 (re-run the acceptance test once, after AD).

Remove from the UI (keep data and routes redirecting where needed):

| Remove or hide                               | Why                                                      |
| -------------------------------------------- | -------------------------------------------------------- |
| Portfolio board, kanban, sponsor-brief count | four vocabularies, no consultant need                    |
| "Start the intake" and the intake page       | public button that ends on a login; set-up is a mission  |
| Synergies tab                                | cross-mission feature for a product with one mission     |
| Badges, mascot quiz, "discover your mascot"  | off-brand for a consultancy; the done page must end calm |
| Data tab as a nav entry                      | export answers lives in Answers; erasure under Settings  |
| Names to hide, Teams, Audit trail as tabs    | into mission Settings and workspace Settings             |
| About page                                   | the front page is the About                              |
| Mascots and the trust line on the front page | owner rejected; not helping anyone act                   |
| "Opportunities" as a screen name             | becomes Findings and Actions inside Report               |

## 6. Glossary (one word per concept, FR and EN, no "auditor")

| Concept               | EN                     | FR                     | Replaces                               |
| --------------------- | ---------------------- | ---------------------- | -------------------------------------- |
| the consultancy       | EvolAI, the EvolAI team| EvolAI, l'équipe EvolAI| auditor, consultant, auditeur          |
| one client audit      | Mission                | Mission                | engagement, audit, portfolio           |
| the client company    | Client, organisation   | Client, organisation   | tenant, workspace, locataire           |
| the client's contact  | Referent               | Référent               | sponsor, contact                       |
| a person who answers  | a person, your team    | une personne, votre équipe | respondent, pseudonym, employee     |
| the questionnaire     | Survey                 | Questionnaire          | intake, quiz                           |
| sent links            | Links                  | Liens                  | invitations, batch                     |
| collected data        | Answers                | Réponses               | submissions, soumises                  |
| what EvolAI found     | Findings               | Constats               | themes, analyses, opportunities        |
| what to do            | Actions                | Actions                | improvement steps, opportunities       |
| the deliverable       | Report                 | Rapport                | sponsor brief, delivery                |
| the number            | Readiness score        | Score de préparation   | literacy score, badge                  |

Report and PDF text are signed "EvolAI". The referent home today says "l'auditeur" three times on one screen;
those become "EvolAI".

## 7. Visual direction

Confirm the kit as is: midnight ink, teal, blue, apricot as a small accent, cloud, slate, Inter, the three-step
symbol, the tagline. Plain MUI chrome, no bar colour, one container width shared by header, content and footer.

Before applying it everywhere, three things are missing:

1. **Contrast rule for teal.** Teal #19A999 on white is about 2.9:1 and white on teal is the same: both fail
   AA. The filled button is ink text on teal (passes, about 5:1), or white on a darker teal token for the light
   theme; teal links and small text on light use a darker teal token (around #12807A). On ink, teal passes.
   Add the two tokens once, measure in the contrast test.
2. **The symbol everywhere, the home-made blobs nowhere**: favicon, app icons, OG image, email header, PDF
   header and cover. The PDF has no branding today.
3. **One lockup with Inter as live text or paths**, not the kit SVG's fallback font (already in the AC brief).

## 8. Order of the paused tasks

1. **AC, trimmed, now.** It is in progress and it answers the loudest complaints. Keep items 1, 2, 3, 4, 5, 8,
   10, 11, 12, 13. Replace item 9 (front-page copy) with section 2 above. Drop item 6 (review every page): AD
   reshapes the pages, so polishing them first is waste. Add: drop the About page, drop "Start the intake".
2. **AD, next, enlarged with the answers work.** Missions home, mission page with the brief as Overview, two
   nav entries, test data hidden, vocabulary pass. Fold in TASK-AA item 3 (answers view and export) and item 2
   (honest publish refusal), since AD creates the Answers tab. Remove the list in section 5.
3. **AB, last, shrunk.** Keep items 1 (dates), 2 (host fallback), 3 (headcount sentence), 5 (one duration),
   6 (section name), 7 (empty plan). Drop item 4 if AC's FR | EN control already covers phones.
4. **AA: drop as a task.** Its item 1 (analysis trigger) and the pipeline Playwright spec are not MVP (section
   4). Its items 2 and 3 move into AD. Delete the worktree.

Then one re-run of the two-persona acceptance test on the live site, the native French read of the final
strings, and the first real mission.
