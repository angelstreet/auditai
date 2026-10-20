# TASK-W — Anonymise free-text answers when they are saved (MVP) (model: sonnet)

Owner decision: the pilot is an MVP; the data question is settled if the answers are anonymised. Today redaction
(services/ai/src/llm/redaction.ts, per-organisation terms in `ai_redaction_terms`) is applied only to a copy sent to a
model; the free-text answer stored in the database keeps whatever the employee typed. Make the stored answer
anonymous: the original text must never be stored.

## Ground rules

- Public repo: no secrets, NO real client or person names anywhere (use "Demo Client" / "Demo Referent"; the
  BANNED_TERMS secret fails the leak scan otherwise). Read AGENTS.md, docs/UI_RULES.md, docs/adr/0029 (redaction),
  docs/adr/0040 (privacy notice), docs/AUDIT_WORKFLOW.md (MVP scope: keep it small, do not add gates).
- Own worktree + branch off origin/main. Owner rule: merge to main yourself when gates pass (format:check, lint,
  typecheck, test, leak-scan, style-guard, Playwright --workers=1) and confirm main CI green and the Vercel deploy
  READY. ADR for the decision. Forward-only migrations: name each in your STATUS (the manager applies it to Neon).
- HEADLESS RUN RULE: the process exits when you stop calling tools. NEVER end your turn while something is running or
  pending; wait with blocking commands in one tool call (`while pgrep -f playwright >/dev/null; do sleep 15; done;
tail -40 file`, tool timeout 600000). Final answer only when merged and the deploy READY, or truly blocked
  (STATUS: blocked: reason). Keep tool output small (| tail -30); commit and push after each step.
- MEMORY: the box kills big processes (earlyoom). Vitest: `NODE_OPTIONS=--max-old-space-size=1536 corepack pnpm exec
vitest run --pool=forks --poolOptions.forks.singleFork=true <files>`; never vitest and Playwright together; stop
  servers you start.

## Do

1. **Anonymise on ingestion.** In the answer-saving path (apps/web/src/app/api/answer and the quiz and intake free-text
   paths if they store respondent text), run every free-text value through one shared `anonymise()` before it is
   written. Rules, rule-based, deterministic, no network, fr and en:
   - e-mail addresses, phone numbers (international and French formats), URLs, IBAN-like and long digit sequences,
     employee/badge-like ids, social handles (@name), postal addresses patterns (street number + word + postcode);
   - the organisation's names-to-hide list (`ai_redaction_terms` for that tenant: company, product, team and people
     names, case and accent insensitive, word boundaries) replaced by a stable placeholder per term within one answer;
   - likely person names: capitalised words after titles (M., Mme, Mr, Mrs, Dr, Monsieur, Madame) and capitalised
     first-name + last-name pairs that are not at a sentence start and not in a stop list (months, days, common
     tool and company names such as ChatGPT, Excel, Teams, Outlook, Copilot, Google, Microsoft, SAP, etc. kept in
     one editable list); a conservative heuristic: prefer masking a few extra words over leaking a name;
   - placeholders are readable: [email], [téléphone] / [phone], [lien] / [link], [nom] / [name], [organisation];
     language follows the engagement language.
     Store only the anonymised text. Keep nothing of the original anywhere: not in logs, errors, the audit log, test
     snapshots, or a "raw" column. Add a unit-test corpus (fr and en, 60+ cases: positives, near-misses, false
     positives such as "Excel", "Teams", "Monsieur" alone) and a regression test that scans the database after a
     Playwright submission for the typed email/phone/name.
2. **Tell the employee, in plain words, once, on the question page that has free text:** "Do not write names, emails
   or phone numbers. We hide them automatically." (fr and en catalogs; short; no scary tone). Show nothing scary if
   nothing was masked.
3. **Backfill existing answers:** a script `pnpm anonymise:backfill` (dry run by default, `--apply` to write, reports
   counts per tenant, never prints answer text) that runs the same function over already stored free-text answers.
   Safe to run on the live Neon database later; idempotent; audit-logged.
4. **Update the notices:** the privacy notice and the employee entry page say that free-text answers are anonymised
   automatically before being saved and that no name is kept (only if true after your change). Update
   docs/AUDIT_WORKFLOW.md (data question settled by anonymisation), docs/RUNBOOK.md (how to add names to hide before
   a pilot, how to run the backfill), docs/HANDOVER.md, ROADMAP.
5. **The AI step uses the anonymised text only** (it already redacts again: keep that second pass). Do not add new AI
   gates or config. Gates and tests as above; Playwright for the submit-and-check flow in fr and en.
