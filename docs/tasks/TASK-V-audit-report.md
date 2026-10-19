# TASK-V — Audit report, improvement steps and client results (model: opus)

Readiness items 8 to 10 of docs/AUDIT_WORKFLOW.md: today the auditor can approve themes and opportunities, but there
is no deliverable the client can read, no improvement suggestions, and no plan. Build the audit result the client
receives. Another worker (TASK-U) is finishing login, privacy notice and the audit-trail screen; do not edit those
files (apps/web/src/app/privacy, login and password pages, audit-trail page). Rebase often.

## Ground rules

- Public repo: no secrets, NO real client or person names (use "Demo Client" / "Demo Referent"; the BANNED_TERMS secret
  fails the leak scan otherwise). Read AGENTS.md, docs/PRD.md sections 10, 11 and 25, docs/UI_RULES.md, the skill
  ~/.claude/skills/web-ui-ux-rules/SKILL.md, docs/adr/0029 (AI provider abstraction), docs/AUDIT_WORKFLOW.md.
- Own worktree + branch off origin/main. Owner rule: merge to main yourself when gates pass (format:check, lint,
  typecheck, test, leak-scan, style-guard, Playwright --workers=1) and confirm main CI green and the Vercel deploy
  READY. Split into several small merges (data + services first, then screens, then PDF). ADR per decision (next free
  number at merge time). Forward-only migrations; name each in your STATUS (the manager applies it to the live Neon DB).
- HEADLESS RUN RULE: the process exits when you stop calling tools. NEVER end your turn while something is running or
  pending: wait with blocking commands in one tool call (`while pgrep -f playwright >/dev/null; do sleep 15; done;
tail -40 file`, tool timeout 600000). Final answer only when everything is merged and the deploy READY, or you are
  truly blocked (STATUS: blocked: reason). Keep tool output small (| tail -30); commit and push after each step.
- MEMORY: the box kills big processes (earlyoom). Vitest: `NODE_OPTIONS=--max-old-space-size=1536 corepack pnpm exec
vitest run --pool=forks --poolOptions.forks.singleFork=true <files>`; never vitest and Playwright together; stop
  servers you start.
- Privacy and AI rules stay: nothing client-facing until the auditor approves; every claim keeps its source; groups
  under 5 people hidden; no individual answers, quotes or per-person data in the report; AI is a draft (provider
  abstraction, redaction, cost cap from ADR 0029; mock provider in tests and CI; no real model calls in CI).

## Do

1. **Improvement-step catalogue (data, bilingual).** A versioned catalogue (JSON in packages/contracts or a table
   seeded by forward migration, your call, ADR) of interventions: simplify a step, automate a repeated task, train
   people (literacy gap), introduce an AI assistant, fix data/tooling access, governance. Each has: id, category,
   title and description (fr/en), typical effort, expected impact, risk, prerequisites, typical owner role, and the
   evidence pattern it answers (theme tags). Start with 25 to 30 solid entries.
2. **Match and draft.** For each approved opportunity propose catalogue interventions (rule-based matching on theme
   tags and category first; optional AI re-ranking/drafting behind the provider abstraction, always a draft). The
   auditor edits effort, impact, risk, owner, timing, and accepts or rejects each suggestion.
3. **Readiness score.** Deterministic, explainable score per axis and overall from the literacy and survey axes
   (existing scoring), with thresholds shown in plain words (what the score means), per team only above the minimum
   group size. Unit tests.
4. **Report model and workflow.** Draft report per engagement: executive summary (auditor-written, AI-assisted draft
   with citations to approved themes), readiness score, key findings (approved themes), ranked opportunities
   (impact versus effort matrix and ordered list), improvement steps with owner and timing, risks and prerequisites,
   a 30/60/90-day plan generated from the accepted steps (editable), methodology and privacy note. States: draft,
   in review, published; versioning; audit-logged; only the auditor can edit; publishing requires an explicit
   confirmation; unpublish possible.
5. **Auditor screens** (new files under apps/web/src/app/admin/reports): build the draft, edit sections inline, accept
   or reject suggestions, preview as the client will see it, publish. MUI components, UI_RULES, fr/en, plain words.
6. **Client views** (new files under apps/web/src/app/client/report, plus the sponsor-level aggregate): the published
   report in the referent's space (read only, nothing unpublished visible), print-friendly layout, and a download.
   Add a navigation entry. Respect view-as read-only rules and tenant isolation (tests).
7. **PDF export**: server-side PDF of the published report (choose a light dependency, keep memory low; ADR),
   branded with tokens and the one font, French and English, page numbers, readable on paper.
8. **Tests and docs**: unit tests (score, matching, suppression, no-PII), DB tests with RLS for report tables,
   Playwright (auditor builds and publishes a report on seeded synthetic data; referent sees only the published one;
   fr/en at 360 and 1280; axe), docs (HANDOVER, ROADMAP, RUNBOOK: how to produce the audit result for a client,
   AUDIT_WORKFLOW update marking items 8 to 10 done), and a short owner guide `docs/AUDITOR_GUIDE.md` (how to run
   an audit end to end in the app, in plain words).
