# TASK-Z2 — Questionnaire v1 for the pilot: free-text questions and neutral wording (model: sonnet)

An acceptance test showed that the seeded questionnaire has only choice questions, so the analysis never produces
themes, opportunities or improvement steps and the report cannot be published; and the owner-facing questions read
like an exam with right answers ("Une bonne demande dit le but...", "L'IA n'est pas toujours la bonne réponse.")
followed by a quiz that says "Il n'y a pas de mauvaise réponse". Fix the CONTENT, keep code changes minimal (MVP).

## Ground rules

- Public repo: no secrets, NO real client or person names (use "Demo Client"; BANNED_TERMS fails the leak scan).
- IMPORTANT: on codebox ~/evolai is on someone else's branch. NEVER commit, pull or edit in ~/evolai. Own worktree:
  `git -C ~/evolai fetch origin && git -C ~/evolai worktree add -b feat/questionnaire-v1 ~/evolai-taskz2 origin/main`.
  Other workers (TASK-W anonymisation touches app/api/answer, TASK-Y the finish flow) are active: rebase before merging.
- Owner rule: merge to main yourself when gates pass (format:check, lint, typecheck, test, leak-scan, style-guard,
  Playwright --workers=1 for the survey specs) and confirm main CI green and the Vercel deploy READY. Forward-only
  migrations: name each in STATUS (the manager applies it to the live Neon DB). ADR note.
- HEADLESS RUN RULE: the process exits when you stop calling tools. NEVER end your turn while something is running or
  pending; wait with blocking commands in one tool call (`while pgrep -f playwright >/dev/null; do sleep 15; done;
tail -40 file`, tool timeout 600000). Final answer only when merged and the deploy READY, or truly blocked.
  Keep tool output small (| tail -30); commit and push after each step.
- MEMORY: earlyoom kills big processes. Vitest: `NODE_OPTIONS=--max-old-space-size=1536 corepack pnpm exec vitest run
--pool=forks --poolOptions.forks.singleFork=true <files>`; never vitest and Playwright together; stop servers you start.

## Do

1. **Find how the questionnaire is defined** (seed template in infra/db/migrations/0003_seed_synthetic.sql,
   apps/web/src/lib/syntheticTemplate.ts, packages/i18n quiz items, the `question_items` table and the way the
   survey pages render kinds). Add a way to define a questionnaire version in the repo (a versioned JSON/TS file plus a
   forward migration or a seed script that creates the questionnaire version for an engagement) without editing
   applied migrations; the owner can later change questions by editing that file (document in docs/RUNBOOK.md).
2. **Questionnaire v1 (French and English, plain words, one idea per question, about 6 to 8 minutes):**
   - Keep the six short choice questions but rewrite them neutrally: describe situations and ask what the person
     usually does ("En général, que faites-vous quand...") with an honest "Je ne sais pas / Ça dépend" option, no
     hints, no right answers, no judgement words.
   - Add THREE optional free-text questions (kind short_text or long_text, whichever the pipeline expects, max about
     400 characters, clear counter, a one-line hint: "Pas de noms, ni e-mails, ni numéros : nous les masquons
     automatiquement."):
     (a) "Pensez à votre dernière semaine de travail. Quelle tâche répétitive vous a pris le plus de temps ?"
     (b) "Quel outil ou quelle information vous a manqué cette semaine pour bien faire votre travail ?"
     (c) "Si un assistant pouvait vous aider sur une seule chose, ce serait quoi ?"
     with matching English. Tag each with the theme axes the analysis pipeline uses (friction, tooling, opportunity;
     check services/ai/src/pipeline.ts and the classifier) and the sensitivity level, so analysis can cluster them.
   - A short role/context question (job family, seniority band) only as coarse categories (no free text), and only
     if it is not identifying for teams under 5 people (document the choice).
3. **Make analysis work on it:** run the existing pipeline on the new questionnaire with synthetic answers (a fixtures
   set of about 12 synthetic respondents, fr and en, containing repetitive tasks, missing tools, wishes) and make sure
   it produces themes and draft opportunities with verbatim citations; fix pipeline gaps if the new kinds are not
   picked up. Add the fixtures to the AI eval so `pnpm ai:eval` covers it (mock provider only; no real model in CI).
4. **Quiz tone:** the optional literacy quiz keeps its scoring but its intro and result copy never say or imply that
   there are wrong answers or a "level" judgement ("Vous débutez"); use encouraging, neutral labels.
5. **Tests and docs:** unit tests for the questionnaire definition and rendering of the new kinds (fr/en, counter,
   hint, skip), Playwright for answering the survey end to end on the new version, update docs/AUDITOR_GUIDE.md
   (what the survey asks), docs/RUNBOOK.md (how to change questions), docs/HANDOVER.md. A short note in the ADR that
   the French needs one native read before the pilot.
