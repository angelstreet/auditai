# FR / EN glossary

One word per concept in both languages. Respondent screens use the "Respondent screens" table;
admin and client screens use the second table. French uses vouvoiement everywhere (ADR 0024).

## Respondent screens

| Concept                    | EN                         | FR                           |
| -------------------------- | -------------------------- | ---------------------------- |
| The person who invited you | team contact               | contact d’équipe             |
| Your anonymous code        | code                       | code                         |
| A survey question          | question                   | question                     |
| Send / save an answer      | answer (verb and noun)     | répondre / réponse           |
| Skip a question            | skip                       | passer                       |
| The optional mascot quiz   | quiz                       | quiz                         |
| Team result without names  | summary for the whole team | synthèse pour toute l’équipe |
| AI chat tool               | AI assistant               | assistant d’IA               |
| Remove my answers          | delete my answers          | supprimer mes réponses       |
| Tap on a phone             | tap                        | toucher / appui              |

## Admin (EvolAI team) and client (referent) screens

One word per concept on every staff and referent screen (docs/FABLE_REVIEW_2026-10-22.md §6). The words in
"Replaces" never appear on screen; some stay as code identifiers and catalog key names only.

| Concept                   | EN                      | FR                         | Replaces                                   |
| ------------------------- | ----------------------- | -------------------------- | ------------------------------------------ |
| The consultancy           | EvolAI, the EvolAI team | EvolAI, l’équipe EvolAI    | auditor, consultant, auditeur              |
| One client audit          | Mission                 | Mission                    | engagement, audit, portfolio               |
| The client company        | Client, organisation    | Client, organisation       | tenant, workspace, locataire               |
| The client’s contact      | Referent                | Référent                   | sponsor, contact, commanditaire            |
| A person who answers      | a person, your team     | une personne, votre équipe | respondent, pseudonym, employee, répondant |
| The questionnaire         | Survey                  | Questionnaire              | intake, quiz, enquête                      |
| Sent links                | Links                   | Liens                      | invitations, batch, lot                    |
| Collected data            | Answers                 | Réponses                   | submissions, soumises                      |
| What EvolAI found         | Findings                | Constats                   | themes, analyses, opportunities            |
| What to do                | Actions                 | Actions                    | improvement steps, opportunities           |
| The deliverable           | Report                  | Rapport                    | sponsor brief, delivery                    |
| The number                | Readiness score         | Score de préparation       | literacy score, badge                      |
| A person’s code (erasure) | Answer code             | Code de réponse            | respondent code, pseudonym                 |
| Approve                   | approve                 | approuver / valider        |                                            |
| Erasure                   | erasure                 | effacement                 |                                            |
| Audit log                 | Audit trail             | Journal d’audit            |                                            |

## Typography (checked by `packages/i18n/src/index.test.ts`)

- No-break space (U+00A0) before `?`, `!`, `;` and `:`; guillemets `« … »`.
- Typographic apostrophe `’` and ellipsis `…`; never `'` or `...`.
- Respondent sentences: 18 words at most (target 12).
