# 0041 - Audit report, improvement-step catalogue and readiness score

- Status: Accepted
- Date: 2026-10-19
- Related: [0007](0007-ai-pipeline.md), [0009](0009-opportunity-register.md), [0029](0029-llm-synthesis-provider-abstraction.md), [0035](0035-view-as-and-client-referent-surface.md), TASK-V

## Context

Readiness items 8 to 10 of `docs/AUDIT_WORKFLOW.md`: the auditor can approve themes and opportunities, but the
client receives nothing they can read, there are no improvement suggestions and no plan. PRD §28.1 lists the
deliverables (brief, results at an aggregate level, a backlog with owner, feasibility and risk, a 30/60/90-day
roadmap); §6.3 asks that a composite readiness score shows its weighting and how missing data is treated; §15 and
§25.1 keep groups under five people hidden and individual answers out of anything the client sees; §10 keeps AI
output a draft until a human approves it.

## Decision

### Improvement-step catalogue: typed data in `packages/contracts`

`improvementCatalogue.ts` holds 29 interventions in six categories (simplify, automate, train, AI assistant, data
and tool access, governance). Each has an id, title and description in French and English, typical effort, impact
and risk (low, medium, high), prerequisites, a typical owner role, and the evidence patterns it answers. A zod
schema validates every entry in a unit test (unique ids, both languages, no prices, no product names, every
evidence pattern answered by at least one entry). `IMPROVEMENT_CATALOGUE_VERSION` is stamped on each report.

Kept as reviewed TypeScript data rather than a seeded table: it changes through pull requests like code, needs
no migration, works the same in tests, CI and production, and is shared by the web app and the AI worker.
A report copies the text of each step it uses, so editing the catalogue never changes an existing report.

### Matching: rule-based first, explainable

`matchImprovements` (`packages/domain`) finds evidence patterns in the opportunity's title and description and in
the labels of the approved findings linked to it, by keyword stems in French and English with accents and case
ignored; the axis adds a weaker hint. An entry scores 2 per keyword pattern and 1 per axis pattern it answers; the
three best are proposed with the patterns that matched, shown to the auditor as "why". Ties keep catalogue order,
so the result is stable. Every proposal is `suggested` until the auditor accepts it, edits effort, impact, risk,
owner and timing, or rejects it; the auditor can also pick any catalogue entry or write a step.

### Readiness score: deterministic and visible

Each completed survey is scored per axis with the existing rubric (`scoreSubmission`). A group's axis score is the
mean of its members' scores (0 to 100). The overall score is the mean of the literacy, practice and readiness axes
with equal weights, shown in the report; an axis nobody answered is left out and the remaining weights are scaled
up, which the report says in plain words. Levels L0 to L5 (PRD §6) at 0, 15, 35, 55, 70 and 85, each with a one-line
meaning. Groups under the minimum (5) are not scored; only a count of hidden teams is shown. Complementary
suppression: when the overall score minus the visible teams would describe a hidden group under five, the smallest
visible team is hidden too. Per-person scores never leave the function. Not a psychometric measure and not for HR
decisions (PRD §6), said in the methodology note.

### Report model and workflow

Migration `0023_audit_reports.sql` adds three tenant-scoped tables with the usual row-level security:

- `audit_reports`: one working report per engagement (title, summary and its cited finding keys, risks, method
  and privacy note, 30/60/90-day plan, catalogue version, last model draft). States `draft`, `in_review`,
  `published`. Only staff (auditor, platform owner, never inside a view-as) can write, through server actions
  that take the tenant from the session.
- `report_steps`: improvement steps per approved opportunity, with source (`rule`, `ai`, `auditor`), status
  (`suggested`, `accepted`, `rejected`) and why they were proposed.
- `audit_report_versions`: the frozen snapshot of each publication. The app role cannot delete it or change it,
  except the two unpublish columns (column-level grant).

Publishing needs the report in review, an explicit confirmation, and a snapshot that passes the gate
(`buildSnapshot`): a summary, at least one citation when there are findings, every citation still an approved
finding, at least one accepted step, no name from the tenant's "names to hide" list, and no run of six words
copied from anything a respondent wrote (free text, rationale, end comment). The snapshot schema is strict, so a
quote, an answer or a per-person value has no field to travel in. Publishing replaces the visible version;
unpublishing withdraws it and puts the report back to draft; editing a published report starts the next version
as a draft while the client keeps the published one. Every write appends an `audit_log` row (new verbs `report.*`
and `report_step.*`; the payload records what changed, never the text).

The client surface reads only the latest published, not withdrawn snapshot of its engagement, so nothing
unpublished can reach it, and a published report does not move while the auditor works on the next version.

Ranking: an opportunity's impact is the auditor's impact score when set, else the highest impact of its accepted
steps; its effort is the lowest effort of its accepted steps. Priority = 2 x impact - effort. Quadrants: quick
win, big bet, fill-in, reconsider. The plan is generated from the accepted steps by their timing (default: low
effort 30 days, medium 60, high 90, one step later for a high risk) plus the PRD §30.3 checkpoint of each horizon,
and stays editable.

## Alternatives considered

- **Catalogue as a seeded table.** Editable without a deploy, but forward-only migrations for every wording fix,
  a second copy for tests, and nothing gained while one consultancy runs the product. Revisit if clients get their
  own catalogues.
- **Model-only matching.** Opaque, costly, and unavailable until an approved route exists for real data. The
  model may re-rank or draft on top of the rules later (ADR 0029 rules apply), never replace them.
- **Rendering the client view from live tables.** Simpler, but an edit or a newly approved theme would change
  what the client already read, and a bug in a filter could leak a draft. The snapshot is what was approved.
- **A weighted score with expert weights.** No validated basis for unequal weights yet; equal weights are the
  honest default and are shown.

## Consequences

- The auditor has one place to build the deliverable; the client sees a stable, versioned document.
- The report content is written in the engagement language; the screen chrome follows the reader's language.
- Sponsor accounts are not a separate role yet: the report is the engagement-level (sponsor-level) aggregate and is
  shown in the referent space and exported as PDF for the sponsor.
- Forward-only migration 0023 must be applied to the live database before the report screens are used.
