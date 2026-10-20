# Audit workflow and readiness for the first real client

How a real audit runs from the owner's first call to the client's results, who does what, what the product
already does, and what must exist before real employee data goes in. The first client and its referent are
configured in the database only (never in this repo). Sources: PRD sections 4, 9, 10, 15, 25; ROADMAP;
docs/TEST_FEEDBACK_2026-10-19.md.

## The journey

| #   | Phase                      | Who                             | What happens                                                                                                                                                                                                                                                                                                                   | State                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Contract and set-up        | Owner                           | Scope, sponsor alignment, data processing agreement, who is controller, retention period, who may see what, approved AI route (EU-hosted or self-hosted), referent appointed. In the app: client, engagement, team, language, dates, privacy settings, names to hide before analysis, questionnaire.                           | Client, engagement and team exist (seeded). Engagement editing, dates, privacy settings screen: in progress (TASK-T). Redaction terms screen: done. Contract, DPA and approved AI route: owner.                                                                                                                                                |
| 1   | Onboard the referent       | Owner, then referent            | The owner gives the referent a real login. He signs in, lands on his space: what the audit is, what he sees (counts, approved results) and does not see (individual answers, who answered). He confirms the team and headcount.                                                                                                | Referent space exists, view-as works. Real login for him: needs his email and agreement, plus a set-your-own-password link and a password reset (missing).                                                                                                                                                                                     |
| 2   | Invite the team            | Referent (or owner)             | Creates the links, sends one message to the team (what, 5 to 8 minutes, anonymous, deadline, contact), later one generic reminder. He never sees who answered.                                                                                                                                                                 | Link creation, CSV and QR: done. Link list with copy and share, message templates, generic reminders, privacy fix: in progress (TASK-S). Email delivery: adapter built, never run live.                                                                                                                                                        |
| 3   | Employees answer           | Employees, on a phone           | Intro and privacy line, role and context, calibration questions, scenario questions, last seven days of work with friction and opportunity examples, optional literacy quiz and badge. Autosave, skip, resume.                                                                                                                 | Done. Questionnaire content is a synthetic template: it must be tailored to the client and the French read by a native speaker.                                                                                                                                                                                                                |
| 4   | Collect, classify, analyse | System                          | Answers stored under a respondent code only. Names hidden before any model sees text. Pipeline: classify sensitivity, extract facts to a strict schema, themes, contradictions, cross-team synergies, draft opportunities, each claim linked to a verbatim source. Literacy score is deterministic. Nothing client-facing yet. | Built and proven on a mock and once on a cheap real model with made-up data. Needs an approved real route for real data, and a human read of theme quality.                                                                                                                                                                                    |
| 5   | Audit review               | Auditor                         | Opens the draft brief, confirms or rejects themes and contradictions, interviews staff, edits opportunities, scores impact, feasibility and risk, chooses what to publish. A publish gate keeps everything unapproved away from the client.                                                                                    | Review screens and publish gate exist. A readable review experience on real data is untested. Process maps and interview notes (FR-10): not built.                                                                                                                                                                                             |
| 6   | Deliver                    | Auditor to referent and sponsor | Results page in the referent space (themes raised by at least five people, approved opportunities with status), team literacy aggregate, and the audit report: executive summary, readiness score, ranked opportunities, improvement steps with owners and timing, risks, next 30/60/90 days.                                  | Done (TASK-V, ADRs 0041-0043): audit report built in Admin, Reports from approved findings, with readiness score, improvement steps from a catalogue, ranking, 30/60/90-day plan, preview, publish and versions; Report tab and PDF in the referent space. Separate sponsor account and slide export: not built (the PDF goes to the sponsor). |
| 7   | Follow up                  | Referent, auditor               | Pilot tracking, measured benefits, training recommendations, a second pulse. Retention purge and erasure requests.                                                                                                                                                                                                             | Retention and erasure done. Pilot tracking, training recommendations, alternatives comparison (FR-11, FR-12, FR-13): Phase 2, not built.                                                                                                                                                                                                       |

## MVP pilot: what is needed (owner decision 2026-10-19: we are doing an MVP)

To run the first pilot with the first client the product is ready except for the content:

1. The questionnaire tailored to the client (the seeded template is generic) and its French read once by a native
   speaker. Mascot names can wait.
2. The owner creates the invitation links in the app and sends them (or the referent does, with the share page).
   The referent does not even need a login for this: the owner can create the links and use "View as" to check
   what the referent sees.

Everything else below is **later**, before scaling beyond a pilot, and does not block it.

## Later (after the pilot, before scaling)

- Real login for the referent (the "Create sign-in link" flow in docs/RUNBOOK.md already works when wanted).
- Filling the privacy fields per engagement (the notice has safe defaults and hides what is not configured).
- Data processing agreement and controller decision with the client. The data question for free text is settled
  by anonymisation (TASK-W, ADR 0044): names, emails, phone numbers and the client's names-to-hide list are masked
  before an answer is saved, and nothing of the original is kept. Add the client's names to the list before the
  pilot (docs/RUNBOOK.md).
- An approved AI route (until then the analysis runs without AI). The client's names go in the names-to-hide list
  before the pilot, so they are masked in stored answers.
- A recorded recovery drill (backups exist on Neon).
- MFA or SSO for staff and client logins (ROADMAP Gate C).
- A review of themes on real answers by a human, a separate sponsor login, pilot tracking and measured
  benefits, training recommendations, process maps and interview notes (Phase 2).

Done and live (not to redo): items 5, 6, 8, 9 and 10 of the earlier list: referent self-service and the privacy
rule (the referent never sees who answered), auditor set-up screens, the review and improvement-step flow, the
audit report with PDF, and the auditor guide ([AUDITOR_GUIDE.md](AUDITOR_GUIDE.md)).

## Rules that stay true

The auditor and the client never see who gave which answer; the referent sees counts only, never per-person
status; groups under five people are hidden; AI output is a draft until the auditor approves it; every claim keeps
its source; real names of clients and people live in the database only.
