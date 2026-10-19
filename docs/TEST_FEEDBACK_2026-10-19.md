# Five-persona test feedback (2026-10-19)

Method: five test agents drove a local copy of the app in a browser (synthetic data, a made-up client "Demo Client"
and referent "Demo Referent"): auditor 1 (first-day consultant), auditor 2 (privacy-minded auditor), referent 1
(phone, 360 px), referent 2 (French, non-technical, then answers the survey as an employee), referent 3 (English,
dark mode, wants results and reminders). Scores out of 10: 4, 6 (trust), 4, 4 and 6.5 (referent and employee), 5. These are test-agent opinions; items marked [code] were checked in the code by the maintainer.

## What already works (all five agree)

Calm, readable screens in both themes. Role boundaries held: anonymous access to admin, client and intake goes to
the login page; a referent typing an admin URL lands on /client; view-as is read only with a clear banner and
"back to my view". The employee survey is short, polite and reassuring (privacy line, skip, "no bad answers").
Keyboard focus and contrast are good.

## Missing or broken, ranked by how many testers hit it and the impact

1. **Sending the links** (all 3 referent testers + auditor 1). The referent and auditor can create links but not
   see, copy or share them: only a CSV download and a QR sheet. Needed: a visible link list with copy buttons,
   share by email/WhatsApp, a ready-made French and English message to paste, the closing date and the contact
   person in that message.
2. **Reminders contradict themselves** (referents 1, 3 and auditor 2). Home says "send a reminder" while the page
   says "Nobody to remind today"; the anchor does not scroll; no message to copy; no schedule.
3. **PRIVACY DESIGN ISSUE [code]: the referent sees who has not answered.** Reminders list the unanswered links.
   The referent hands each link to a named colleague, so he knows link-to-person and can tell exactly who has
   answered. The minimum-group rule only checks the number invited, not who completed. Fix: the referent never
   sees per-link status; reminders are one generic message to everybody; per-link status stays with the auditor
   (who does not know the mapping).
4. **Auditor cannot set an audit up** (auditor 1). No create/edit of engagements (headcount, dates, status, launch),
   no create/rename of teams, no survey preview, no first-run guide. Expected headcount stays 1.
5. **No readable results** (auditor 1, referents 1 and 3). Analyses is an empty table, the referent's Results page
   is an empty state, no charts, no approve-and-share flow, no client summary or PDF, no results export.
6. **Referent home is thin.** Three bare numbers: no per-team progress, no percentage ("12 of 24"), no deadline,
   no trend, "Getting ready" with no date; heading says "Your team" but the body mixes team and engagement.
7. **Privacy notice too thin for GDPR** (auditor 2). No controller, legal basis, contact, retention period,
   sub-processors or AI disclosure; withdrawal goes "through your team contact". The employee never learns who is
   asking, which company, or why (referent 2).
8. **Jargon still on screen** (auditors 1 and 2, referent 2). "tenant", "Locataire", raw engagement ids, "Model
   route", "Run the AI smoke", "PRD §10, Gate B", "Opened: Fewer than 5", mascot tie-break rules, "pseudonym",
   "Taux de réalisation".
9. **Orientation.** After sign-in the landing page is "Data exports and erasure". The header never shows the
   current organisation; "Workspace" silently resets it; the organisation switcher is chips on one page.
10. **French and English quality.** The team name stays French in English pages ("Equipe pilote" without accent,
    "Les liens de Equipe"); a flash of English when switching language; "Livrée" wording; ISO dates; completed
    shown in English; the employee entry page defaults to English when the browser says nothing.
11. **Questions feel like an exam** (referent 2): the optional quiz questions read as right/wrong and "Utilisez-vous
    un assistant d'IA ?" feels sensitive; no "I don't know"; no skip on the quiz.
12. **Data page** (auditors 1, 2): erase of a nonexistent respondent shows a green "0 rows deleted"; no
    type-to-confirm; export shows raw column names and no clear download; no audit-trail screen; no way to find a
    pseudonym.
13. **Small teams and the mascot** (auditor 2): a team mascot for a team of 1 or 2 could reveal a person's result;
    add a minimum group size there too.
14. **Phone details** (referent 1): the read-only banner takes about 23% of the screen; the "Résultats" tab is
    clipped; the number field is cramped; body text 14 px is small.
15. **Smaller:** duplicate-batch protection (no warning, no delete of a batch), link format uses https in a local
    http setup, public /api/health, login has no "forgot password", error-page footer cramped.

## Suggested order

A) Referent self-service: link list + copy/share + message templates + progress % + deadline + fix reminders
(items 1, 2, 6) together with the privacy redesign of item 3. B) Auditor setup: engagements, teams, header
organisation, landing page, jargon and French fixes (items 4, 8, 9, 10). C) Privacy notice, erase/export/audit-trail
fixes, mascot guard (items 7, 12, 13). D) Results that people can read (item 5), then questions tone (item 11).
