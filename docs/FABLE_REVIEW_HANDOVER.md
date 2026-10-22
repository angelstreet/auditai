# Review handover: goals, owner complaints, state (2026-10-22)

Purpose: one document for an independent review (Fable) before any further build. Everything in flight is paused.
Read this, then [AUDIT_WORKFLOW.md](AUDIT_WORKFLOW.md), [HANDOVER.md](HANDOVER.md), [UI_RULES.md](UI_RULES.md),
[brand/brand-board.png](brand/brand-board.png), [TEST_FEEDBACK_2026-10-19.md](TEST_FEEDBACK_2026-10-19.md). The live site is
https://www.evolai.io (sandbox client "Demo Client"; real client data lives only in the database).

## 1. The goal, as the owner states it (and where we misunderstood it)

EvolAI is the **tool of a consulting company**. The consultants (us, the owner and the people we work with) help a
company audit its organisation regarding AI. The intended flow:

1. **Before the first meeting:** the client's people onboard through the tool (short anonymous survey on how they work
   and use AI; a referent at the client launches it).
2. **When we go on site** we already have enough data (what people do, where AI helps, where it is risky, what they
   know) to **accompany them directly**, without spending the visit collecting basics.
3. **After:** we give them a concrete way to improve on their AI journey (readiness score, ranked actions, 30/60/90
   day plan, training), and follow up.

Consequences the owner draws:

- **We are the auditors and the creators of the platform.** The product must not talk about "auditors" to anyone
  (no "for auditors and consultants of your organisation"). The client sees EvolAI, a referent, and a report.
- The visible product has **three audiences**: (a) the EvolAI team (staff: set up a mission, follow answers, write
  and publish the report), (b) the client referent (launch and follow, never see who answered), (c) the client's
  employees (answer on a phone in 7 minutes). The public front page and the sign-in page are for people arriving
  from outside; today they talk to nobody in particular.
- What we built so far (login hardening, audit trail, privacy tooling, kanban portfolio, many admin tabs) drifted
  toward a generic multi-tenant SaaS and an enterprise compliance product. The owner wants an **MVP that serves the
  consultant workflow above**, simple and elegant, standard components, no invention.

## 2. Everything the owner is unhappy about (full list, in the owner's order of appearance)

Look and feel

1. The first UI was "ugly" and reinvented what libraries do (custom widgets, words instead of icons). Wanted: standard
   (MUI), icons, design tokens, light and dark done properly (dark was too dark, near black), one font (Inter).
2. After signing in, "I don't know who I am" (identity not visible); titles on three lines, misaligned; question cards
   with three-line titles. (Partly fixed in TASK-L; to re-check.)
3. **The provided brand pack is not used.** A full kit exists (logos, icons, tokens, splash, social, board); the app
   uses a home-made logo (three blobs, no wordmark in places). The kit is now in the repo
   (`apps/web/public/brand/kit/`, `docs/brand/brand-board.png`, commit 2228d39).
4. **Ugly cartoon mascots on the front page.** Mascot names and art are not wanted on first-impression pages.
5. **Language toggle is a custom globe dropdown**; should be a standard control (FR | EN).
6. **Privacy and About belong in the footer, never the header.** Today they are in the header and duplicated
   (header, under the sign-in form, footer).
7. Sign-in page: **logo shown twice**; content centred while the header logo is left-aligned; the footer is a messy
   mix (symbol, licence sentence, three links wrapped unevenly).
8. **Front-page text is poor** ("Set the scene / Listen to teams / Review together / Act") and the trust line "We
   never ask for names. Team totals only. A person approves everything shared" is "completely useless". A proposal
   exists (three steps Understand, Adapt, Evolve echoing the logo) but is **not approved**; it was written before the
   goal was clarified.
9. The word **"auditor"** is visible to users (sign-in help text, account menu role line, admin labels, report text).
10. **Account menu** misaligned: "View as" rows centred and wrapped on two lines while other rows are left-aligned;
    it shows person names and the role "Auditor"; synthetic organisations are listed.
11. **Signed-in home ("Portfolio board") is "very confusing"**: nine overflowing tabs (one label cut), "Welcome page"
    and "Open intake" buttons, "4 engagement(s), 0 sponsor brief(s)", a five-step checklist where all steps are Done
    yet still shown as links, and a kanban (Intake, Field, Auditor review, Opportunities, Delivery) mixing four
    vocabularies. Wanted: one clear path.
12. Test organisations ("Synthetic tenant A/B", sample cards) appear in the live account switcher and board.
13. Wording polish and mascot names were deferred by the owner earlier; native French read still outstanding.

Scope and process

14. We added enterprise gates the owner did not ask for (DPA, approved AI route, privacy-field filling, real referent
    login, recovery drill, MFA/SSO): "we are doing MVP, you go too far". They are parked under "Later".
15. Real client and referent names were written into the public repo once (still in three old commits; the owner
    declined a history rewrite; a leak scan with a secret list now guards it).
16. Preview deployments on Vercel failed on every branch ("Resource provisioning failed"); previews are now disabled.
17. Worker sessions kept dying (memory pressure, headless runs exiting) and the build cost a lot of time.

Functional findings from the last acceptance test (MiniMax tester, final live version; full report on codebox
`~/handovers/auditai/MINIMAX-TEST-REPORT.md`; verdict: auditor side 6/10, referent/employee side 8/10)

18. **Blocker:** no way to run the analysis in production (no button, no schedule); no findings can be produced from
    real answers.
19. The report publish refusal sends the user to that missing step.
20. No export of answers and no screen showing free-text answers (the runbook promises an export).
21. The invitation message and referent home promise the closing date but links expire after 14 days.
22. Links point to the vercel.app host (APP_BASE_URL now set on Vercel, code fallback pending).
23. Team name unaccented (fixed in the database); headcount 0 shows "0 expected, 3 invited"; bare globe for language
    on phones; referent home says 4 minutes, survey says 7; "Liens ouverts" lists unused links; empty "30/60/90"
    heading in the PDF.
24. Earlier acceptance test (before fixes Y, W, Z2, Z1): auditor 3/10, referent 6/10, employee 6/10; fixes merged
    since, not re-run end to end except by the MiniMax test above.

## 3. State of the work

- `main` is green and deployed (production only). Migrations 0001 to 0025 applied on Neon. Stack: Next.js 14 on
  Vercel (fra1), Neon Postgres with row-level security, MUI, Inter, FR/EN through packages/i18n.
- **Paused, unmerged (branches exist on codebox worktrees, nothing pushed to main):**
  TASK-AA analysis trigger, copy fix and answers export/view (`fix/analysis-and-answers`);
  TASK-AB invitation dates, link host, counters, copy polish (`fix/invitation-and-copy-polish`);
  TASK-AC brand kit, standard header/footer/language toggle, no mascots, no "auditor" wording, account menu
  (`feat/brand-kit`, work in progress);
  TASK-AD simple admin home (Missions list, one next step, four nav entries): brief written, not started.
  Briefs: `docs/tasks/` and codebox `~/handovers/auditai/TASK-A[A-D]-*.md`. Their content predates the clarified goal
  and may need to change after the review.
- Done and live: auth and roles, view-as, referent self-service, invitations (CSV, QR, copy), anonymised answers,
  questionnaire v1 (10 questions, FR/EN), improvement-step catalogue, readiness score, audit report with PDF and
  versions, audit trail, retention and erasure, CI (lint, types, tests, style guard, leak scan, Playwright with axe).

## 4. Questions for the reviewer

1. Is the product framing right: a consultant-run, pre-engagement data-gathering and improvement-plan tool with a
   thin client side? What is the **minimum** that serves "arrive on site with enough data and accompany them"?
2. **Landing page and sign-in:** who is each for and what should they say? (Prospective client, referent arriving
   from a link, EvolAI staff.) One sentence, one action. Should the public front page exist at all beyond sign-in
   and a short "what is EvolAI" for clients?
3. **Information architecture for the EvolAI team**: is "Missions list, one mission page with Overview, Invitations,
   Answers, Report, Settings" the right shape? What else must a consultant see before a site visit (a pre-visit
   brief per team: where AI is used, friction, opportunities, risks, literacy)?
4. **The analysis step**: for the MVP, button on demand, scheduled, or done by hand with the exported anonymised
   answers? What is the smallest thing that gives consultants usable insight before the visit?
5. Which of the 24 items above are MVP-blocking and which are noise? Which tabs, screens and features should be
   removed or hidden (kanban, synergies, badges and mascot quiz, intake, portfolio board, names-to-hide screen)?
6. Vocabulary: one glossary for staff screens, client screens and the report, with no word "auditor" visible.
7. Visual direction: confirm the brand kit (navy, teal, blue, apricot, Inter, three-step symbol) and a plain MUI
   chrome; anything missing before we apply it everywhere.
8. Re-order the paused tasks AA, AB, AC, AD given the answers, and say what to drop.

## 5. How to look

- Live: https://www.evolai.io (staff sign-in with the owner account; use "Demo Client"). Local: `pnpm local:up`.
- Screens to view first: front page, sign-in, signed-in home, a mission, the referent view (View as), the survey link
  on a phone, the report and PDF.
- Test evidence: MiniMax acceptance report and screenshots on codebox `~/handovers/auditai/`.
