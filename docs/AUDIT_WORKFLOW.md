# Audit workflow and readiness for the first real client

How a real audit runs from the owner's first call to the client's results, who does what, what the product
already does, and what must exist before real employee data goes in. The first client and its referent are
configured in the database only (never in this repo). Sources: PRD sections 4, 9, 10, 15, 25; ROADMAP;
docs/TEST_FEEDBACK_2026-10-19.md.

## The journey

| #   | Phase                      | Who                             | What happens                                                                                                                                                                                                                                                                                                                   | State                                                                                                                                                                                           |
| --- | -------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Contract and set-up        | Owner                           | Scope, sponsor alignment, data processing agreement, who is controller, retention period, who may see what, approved AI route (EU-hosted or self-hosted), referent appointed. In the app: client, engagement, team, language, dates, privacy settings, names to hide before analysis, questionnaire.                           | Client, engagement and team exist (seeded). Engagement editing, dates, privacy settings screen: in progress (TASK-T). Redaction terms screen: done. Contract, DPA and approved AI route: owner. |
| 1   | Onboard the referent       | Owner, then referent            | The owner gives the referent a real login. He signs in, lands on his space: what the audit is, what he sees (counts, approved results) and does not see (individual answers, who answered). He confirms the team and headcount.                                                                                                | Referent space exists, view-as works. Real login for him: needs his email and agreement, plus a set-your-own-password link and a password reset (missing).                                      |
| 2   | Invite the team            | Referent (or owner)             | Creates the links, sends one message to the team (what, 5 to 8 minutes, anonymous, deadline, contact), later one generic reminder. He never sees who answered.                                                                                                                                                                 | Link creation, CSV and QR: done. Link list with copy and share, message templates, generic reminders, privacy fix: in progress (TASK-S). Email delivery: adapter built, never run live.         |
| 3   | Employees answer           | Employees, on a phone           | Intro and privacy line, role and context, calibration questions, scenario questions, last seven days of work with friction and opportunity examples, optional literacy quiz and badge. Autosave, skip, resume.                                                                                                                 | Done. Questionnaire content is a synthetic template: it must be tailored to the client and the French read by a native speaker.                                                                 |
| 4   | Collect, classify, analyse | System                          | Answers stored under a respondent code only. Names hidden before any model sees text. Pipeline: classify sensitivity, extract facts to a strict schema, themes, contradictions, cross-team synergies, draft opportunities, each claim linked to a verbatim source. Literacy score is deterministic. Nothing client-facing yet. | Built and proven on a mock and once on a cheap real model with made-up data. Needs an approved real route for real data, and a human read of theme quality.                                     |
| 5   | Audit review               | Auditor                         | Opens the draft brief, confirms or rejects themes and contradictions, interviews staff, edits opportunities, scores impact, feasibility and risk, chooses what to publish. A publish gate keeps everything unapproved away from the client.                                                                                    | Review screens and publish gate exist. A readable review experience on real data is untested. Process maps and interview notes (FR-10): not built.                                              |
| 6   | Deliver                    | Auditor to referent and sponsor | Results page in the referent space (themes raised by at least five people, approved opportunities with status), team literacy aggregate, and the audit report: executive summary, readiness score, ranked opportunities, improvement steps with owners and timing, risks, next 30/60/90 days.                                  | Results page exists but only shows approved items. Audit report generator, sponsor view, PDF or slide export and improvement recommendations: not built.                                        |
| 7   | Follow up                  | Referent, auditor               | Pilot tracking, measured benefits, training recommendations, a second pulse. Retention purge and erasure requests.                                                                                                                                                                                                             | Retention and erasure done. Pilot tracking, training recommendations, alternatives comparison (FR-11, FR-12, FR-13): Phase 2, not built.                                                        |

## Readiness checklist before real data

Must have (blocking):

1. Real login for the referent: owner supplies his email and his agreement; set-own-password link, password reset,
   strong password rule; MFA or SSO is still open (ROADMAP Gate C).
2. Completed privacy notice (controller, legal basis, retention, contact, sub-processors, AI disclosure, how to
   withdraw without going through a manager) and a signed processing agreement with the client.
3. An approved AI route (EU-hosted or self-hosted, written down in the contract) and the client's names added to
   the redaction terms. Until then run the rule-based pipeline only.
4. The questionnaire tailored to the client, French reviewed by a native speaker, mascot names decided.
5. Referent self-service finished (TASK-S) including the rule that the referent never sees who answered.
6. Engagement set-up screens (TASK-T): headcount, dates, status, teams, contact person.
7. A recovery drill run once and recorded (backups exist on Neon; the drill is written, not run).

Needed to deliver the audit result (not blocking the survey itself): 8. A review experience that works on real answers (grouping, source quotes, accept or reject in one tap). 9. The audit report: structured document generated from approved findings, with improvement steps and a
30/60/90-day plan, exported as PDF and shown in the client space; a sponsor view with aggregated results. 10. Improvement suggestions: a catalogue of interventions (simplify, automate, train, introduce AI) mapped to
each approved opportunity with effort, impact, risk and an owner; the model may draft, the auditor approves. 11. Phase 2 follow-up: pilot tracking and measured benefits, training recommendations.

## Rules that stay true

The auditor and the client never see who gave which answer; the referent sees counts only, never per-person
status; groups under five people are hidden; AI output is a draft until the auditor approves it; every claim keeps
its source; real names of clients and people live in the database only.
