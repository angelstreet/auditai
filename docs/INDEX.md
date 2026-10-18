# EvolAI docs — index & map

> Top-level entry point for the public docs in this repo. If a thing is
> not linked from here, it is not part of the "owned-by-docs" surface.

This index is the **map contract** for everything under `docs/`. The
contract: every artifact under `docs/` belongs to one of four buckets
below; every ADR is reachable in two hops; every ROADMAP milestone names
its ADRs; every gate names its blocking evidence.

---

## 1. The four buckets

| Bucket       | Files                                                                                                                         | Purpose                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Product      | [PRD.md](PRD.md)                                                                                                              | Full product requirements (35 sections). Public, anonymised.                                   |
| Delivery     | [ROADMAP.md](ROADMAP.md)                                                                                                      | Phase / milestone / gate state. Mirrors PRD §18. Updated in the merge that ships a milestone.  |
| Architecture | [adr/](adr/)                                                                                                                  | Numbered ADR records. Every significant technical decision lands here. Never amend an old ADR. |
| Workflow     | [INDEX.md](INDEX.md) (this file), [README.md](../README.md), [AGENTS.md](../AGENTS.md), [CONTRIBUTING.md](../CONTRIBUTING.md) | Working agreements + the public top-level story.                                               |

## 2. The PRD section map

The PRD has 35 sections across two parts (Part I: product surface, Part II:
security / governance / operations / value). Below is the section-by-section index.

### Part I — Product requirements

| §                          | Title                                               | Mirrors in the roadmap     | ADRs                                                                                                                                                                                                           |
| -------------------------- | --------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1                          | Positioning and terminology                         |                            |                                                                                                                                                                                                                |
| 2                          | Product goals and non-goals                         |                            |                                                                                                                                                                                                                |
| 3                          | Personas and permissions                            |                            |                                                                                                                                                                                                                |
| 4                          | Core user journeys                                  | M5, M10, M11, M12, M14     | [0004](adr/0004-mobile-web-survey-stack.md), [0008](adr/0008-auditor-review.md), [0009](adr/0009-opportunity-register.md), [0010](adr/0010-sponsor-onboarding.md), [0013](adr/0013-quiz-badges-and-mascots.md) |
| 5                          | Mobile-first experience requirements                | M5                         | [0004](adr/0004-mobile-web-survey-stack.md)                                                                                                                                                                    |
| 6                          | Adaptive AI maturity model                          | M2, M14                    | [0002](adr/0002-monorepo-tooling.md), [0013](adr/0013-quiz-badges-and-mascots.md)                                                                                                                              |
| 7                          | Workflow discovery questionnaire                    | M5                         | [0004](adr/0004-mobile-web-survey-stack.md)                                                                                                                                                                    |
| 8                          | The six AI-first learning principles                |                            |                                                                                                                                                                                                                |
| 9                          | Functional requirements by priority (FR-01 … FR-17) | All milestones             | All ADRs                                                                                                                                                                                                       |
| 10                         | AI workflow design                                  | M9                         | [0007](adr/0007-ai-pipeline.md)                                                                                                                                                                                |
| 11                         | Opportunity data contract                           | M11                        | [0009](adr/0009-opportunity-register.md)                                                                                                                                                                       |
| 12                         | Suggested stack and build-vs-buy                    | M2                         | [0002](adr/0002-monorepo-tooling.md)                                                                                                                                                                           |
| 13                         | Repository / code organization                      | M2                         | [0002](adr/0002-monorepo-tooling.md)                                                                                                                                                                           |
| 14                         | Data model (logical)                                | M3, M4                     | [0003](adr/0003-postgres-migrations-and-rls.md)                                                                                                                                                                |
| 15                         | Security, privacy, and governance                   | All milestones             | [0003](adr/0003-postgres-migrations-and-rls.md), [0006](adr/0006-local-dev-runner.md), [0010](adr/0010-sponsor-onboarding.md), [0013](adr/0013-quiz-badges-and-mascots.md)                                     |
| 16                         | UX acceptance criteria                              | M5, M6                     | [0004](adr/0004-mobile-web-survey-stack.md), [0005](adr/0005-admin-engagements-page.md)                                                                                                                        |
| 17                         | Non-functional requirements                         | M7, M8                     | [0006](adr/0006-local-dev-runner.md)                                                                                                                                                                           |
| 18                         | Rollout phases, timelines and gates                 | [ROADMAP.md](ROADMAP.md)   |                                                                                                                                                                                                                |
| 19                         | Success metrics and instrumentation                 | M14 (literacy tier rollup) | [0015](adr/0015-team-badge-rollup.md)                                                                                                                                                                          |
| 20                         | Detailed first pilot                                | M12 (sponsor onboarding)   | [0010](adr/0010-sponsor-onboarding.md)                                                                                                                                                                         |
| 21                         | Example user stories                                |                            |                                                                                                                                                                                                                |
| 22                         | Open decisions / product risks                      |                            |                                                                                                                                                                                                                |
| 23                         | Delivery acceptance / definition of done            |                            |                                                                                                                                                                                                                |
| References and assumptions |                                                     |                            |

### Part II — Security, governance, cost, ops, value

| §   | Title                                             | Mirrors in the roadmap         | ADRs                                                                                                                                                                                                               |
| --- | ------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 24  | Open-source product and paid-services model       |                                | [0001](adr/0001-license-and-stack.md)                                                                                                                                                                              |
| 25  | Security & privacy requirements (incl. **Gates**) | M3, M4, M6, M7, M10, M11, M14  | [0003](adr/0003-postgres-migrations-and-rls.md), [0008](adr/0008-auditor-review.md), [0009](adr/0009-opportunity-register.md), [0011](adr/0011-cross-team-synergy.md), [0013](adr/0013-quiz-badges-and-mascots.md) |
| 26  | Cost management / FinOps                          | M9                             | [0007](adr/0007-ai-pipeline.md)                                                                                                                                                                                    |
| 27  | Audit service catalogue & pricing                 |                                |                                                                                                                                                                                                                    |
| 28  | Repeatable audit process and timeline             |                                |                                                                                                                                                                                                                    |
| 29  | Audit-quality rubric                              |                                |                                                                                                                                                                                                                    |
| 30  | Measuring gains after an audit                    |                                |                                                                                                                                                                                                                    |
| 31  | Feedback and continuous improvement               |                                |                                                                                                                                                                                                                    |
| 32  | Client FAQ                                        |                                |                                                                                                                                                                                                                    |
| 33  | Additional engineering requirements & tests       | M4 (RLS deny), M5 (Playwright) | [0003](adr/0003-postgres-migrations-and-rls.md), [0004](adr/0004-mobile-web-survey-stack.md), [0008](adr/0008-auditor-review.md)                                                                                   |
| 34  | Open questions before v1 release                  |                                |                                                                                                                                                                                                                    |
| 35  | Primary governance references                     |                                |                                                                                                                                                                                                                    |

## 3. The ADR index

Numbered, current, and tied to the milestone that introduced them. Order
is also the chronology of design choices. **Never amend** an old ADR;
write a new one that supersedes it.

| #    | Title                                                                                      | Milestone                        | Status   |
| ---- | ------------------------------------------------------------------------------------------ | -------------------------------- | -------- |
| 0001 | [License & stack](adr/0001-license-and-stack.md)                                           | M1 (initial)                     | Accepted |
| 0002 | [Monorepo + tooling](adr/0002-monorepo-tooling.md)                                         | M2                               | Accepted |
| 0003 | [Postgres migrations + RLS](adr/0003-postgres-migrations-and-rls.md)                       | M4                               | Accepted |
| 0004 | [Mobile web survey stack](adr/0004-mobile-web-survey-stack.md)                             | M5                               | Accepted |
| 0005 | [Admin engagements page](adr/0005-admin-engagements-page.md)                               | M6                               | Accepted |
| 0006 | [Local one-command runner](adr/0006-local-dev-runner.md)                                   | M7                               | Accepted |
| 0007 | [AI pipeline worker](adr/0007-ai-pipeline.md)                                              | M9                               | Accepted |
| 0008 | [Auditor review surface](adr/0008-auditor-review.md)                                       | M10                              | Accepted |
| 0009 | [Opportunity register](adr/0009-opportunity-register.md)                                   | M11                              | Accepted |
| 0010 | [Sponsor onboarding + portfolio board](adr/0010-sponsor-onboarding.md)                     | M12                              | Accepted |
| 0011 | [Cross-team synergy — schema + contract](adr/0011-cross-team-synergy.md)                   | M13 slice A                      | Accepted |
| 0012 | [Cross-team synergy — admin surface](adr/0012-synergy-admin-surface.md)                    | M13 slice C                      | Accepted |
| 0013 | [Quiz badges + mascot SVGs](adr/0013-quiz-badges-and-mascots.md)                           | M14 slice A                      | Accepted |
| 0014 | [Quiz form + result reveal](adr/0014-quiz-form-and-result.md)                              | M14 slice B                      | Accepted |
| 0015 | [Team badge rollup + profile](adr/0015-team-badge-rollup.md)                               | M14 slice C                      | Accepted |
| 0016 | [FR-09 retention + export + deletion](adr/0016-fr09-retention-export-deletion.md)          | M15 slice A                      | Accepted |
| 0017 | [Board integration + landing](adr/0017-board-integration-and-landing.md)                   | M15 slice B                      | Accepted |
| 0018 | [DevX + deploy](adr/0018-devx-and-deploy.md)                                               | M15 slice C                      | Accepted |
| 0019 | [Public-routes Playwright suite](adr/0019-public-routes-playwright.md)                     | M15 slice D                      | Accepted |
| 0020 | [Coverage gate scope](adr/0020-coverage-gate-scope.md)                                     | M15 review (CI gates)            | Accepted |
| 0021 | [Manual e2e workflow](adr/0021-manual-e2e-workflow.md)                                     | M15 review (CI gates)            | Accepted |
| 0022 | [Deploy token + static hosting](adr/0022-deploy-token-and-static-hosting.md)               | M15 review (CI gates)            | Accepted |
| 0023 | [Auditor auth + session](adr/0023-auditor-auth-and-session.md)                             | TASK-A                           | Accepted |
| 0024 | [French + English (i18n)](adr/0024-i18n-fr-en.md)                                          | TASK-C                           | Accepted |
| 0025 | [Design tokens + style guard](adr/0025-design-tokens.md)                                   | TASK-E ([UX audit](UX_AUDIT.md)) | Accepted |
| 0026 | [Rename to EvolAI](adr/0026-rename-to-evolai.md)                                           | TASK-F                           | Accepted |
| 0027 | [One font, Playwright in CI](adr/0027-one-font-and-playwright-in-ci.md)                    | TASK-G                           | Accepted |
| 0028 | [Accessibility gate, next steps](adr/0028-accessibility-gate-and-respondent-next-steps.md) | TASK-I                           | Accepted |

## 4. The gates map (PRD §25.4)

ROADMAP § [Gates](ROADMAP.md#gates-prd-254) names four launch gates. The
map below ties each gate to the evidence already in `main`.

| Gate                             | What it gates                                                              | Evidence already in `main`                                                                                                                 | Owner track next                                                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** — survey pilot             | Tenant isolation, retention, audit logs, approved AI data route            | `tests/db` isolation suite (RLS deny) + `audit_log` table + `retention_at` on `respondent_badges` + rule-based `model_route` on `analyses` | M15 follow-ups: explicit deletion workflow (PRD FR-09) + retention cleanup worker                                                                             |
| **B** — AI synthesis             | Redaction, prompt-injection tests, source traceability, model cost ceiling | `analyses.evidence_json` (sourceKind/sourceId/quote per claim) + `model_route` column + service-account worker posture                     | LLM-backed swap of the four `synthesize*` functions in `services/ai/src/pipeline.ts` (ADR 0007); prompt-injection harness (Phase 2)                           |
| **C** — enterprise hosting       | Recovery drill, SSO/MFA, pen test, agreed SLA                              | Embedded Postgres local runner (M7) provides recovery drill substrate                                                                      | Real auth provider (no SSO yet), real pen test (out of scope), SLA contract (out of scope). Currently actor resolution is `x-audit-actor-id` header fallback. |
| **D** — cross-company benchmarks | Aggregation thresholds, de-identification review                           | Cross-team synergy detection (M13) is the in-tenant precursor; cross-tenant rollups not started                                            | FR-15 / FR-16 (Phase 3)                                                                                                                                       |

## 5. The "how to test it" quick links

```bash
cd ~/evolai
pnpm install --frozen-lockfile
pnpm --filter @evolai/web build
pnpm local:up                    # embedded Postgres + migrations + production build
```

After `READY postgres=... web=... admin=...` prints, exercise:

| Command                                          | What it covers                                              | Skill anchor                                    |
| ------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------------------- |
| `pnpm local:smoke`                               | full mobile-survey walk (`/about → /s/[token] → /done`)     | [M5](adr/0004-mobile-web-survey-stack.md), M7   |
| `pnpm m10:smoke`                                 | auditor review + approve                                    | [M10](adr/0008-auditor-review.md)               |
| `pnpm m11:smoke`                                 | opportunity register + status workflow                      | [M11](adr/0009-opportunity-register.md)         |
| `pnpm m12:smoke`                                 | sponsor intake + portfolio board + 2nd engagement teardown  | [M12](adr/0010-sponsor-onboarding.md)           |
| `pnpm m13:smoke`                                 | cross-team synergy worker + admin surface + transition flow | [M11/M13 ADRs](adr/0011-cross-team-synergy.md)  |
| `pnpm m14:smoke`                                 | quiz form + result reveal + team rollup + profile           | [M14 ADRs](adr/0013-quiz-badges-and-mascots.md) |
| `pnpm --filter @evolai/ai run smoke`             | rule-based AI pipeline end-to-end                           | [M9](adr/0007-ai-pipeline.md)                   |
| `pnpm --filter @evolai/ai run synergy-smoke`     | cross-engagement synergy worker                             | [M13](adr/0011-cross-team-synergy.md)           |
| `pnpm --filter @evolai/ai run team-rollup-smoke` | team-mascot rollup worker                                   | [M14](adr/0015-team-badge-rollup.md)            |
| `pnpm local:status`                              | probes web + Postgres                                       | [M7](adr/0006-local-dev-runner.md)              |
| `pnpm local:down`                                | tears everything down                                       | [M7](adr/0006-local-dev-runner.md)              |

Manual URLs (ports come from the `READY` line):

```
/welcome                   M12 sponsor hero
/intake                    M12 sponsor form + live summary
/board                     M12 portfolio kanban
/quiz                      M14 5-question literacy quiz
/quiz/result               M14 mascot reveal (Tortoise / Fox / Owl)
/admin/engagements         M6 + M9–M11 audit surfaces
/admin/synergies           M13 detected synergies + transitions
/admin/teams               M14 team profile (only dominant mascot, no raw scores)
```

## 6. Conventions in this docs tree

- **Names** — Pseudonym-only everywhere; the public PRD talks about
  "the pilot client" and the ROADMAP / ADRs never refer to a real
  client. See [AGENTS.md](../AGENTS.md).
- **Privacy** — The respondent-facing surfaces (`/quiz`, `/quiz/result`,
  `/admin/teams`) never render raw quiz scores. The smoke scripts
  `m14-smoke.mjs`, `m12-smoke.mjs`, and `m13-smoke.mjs` enforce this
  with regex assertions.
- **RLS** — Every tenant-scoped table has a four-policy RLS pattern
  (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) plus a `SET LOCAL
app.tenant_id` / `app.is_service_account` switch. See ADR 0003.
- **ADR numbering** — Next free is `0029`. One decision per ADR; never
  amend an old one.
- **ROADMAP updates** — The State column flips and the README Status
  block updates in the same PR (or the immediately-following commit
  on `main`) the milestone lands.

## 7. Open follow-ups (read first when planning the next slice)

These are **NOT** blockers for the current shipment but are explicit
follow-ups the owner should consider before any external pilot:

- **FR-09 (PRD §9) — team report export + retention / deletion workflow.**
  Audit logs are done (M10/M11). Export (CSV / PDF), the explicit
  _deletion_ workflow per tenant, and a periodic cleanup worker that
  honours `retention_at` on `respondent_badges` (and the matching date
  on `submissions`) are not yet shipped. The data layer is ready.
- **`/board` integration with synergies + team mascots.** Today the
  kanban shows engagements + opportunities + sponsor briefs
  (M12); synergies live under `/admin/synergies` (M13) and team
  mascots under `/admin/teams` (M14). A future slice can collapse
  these into the portfolio kanban for one-glance overview.
- **LLM-backed synthesis (Gate B).** The current pipeline is fully
  deterministic (ADR 0007). The four `synthesize*` functions are the
  swap point; the row shape on `analyses` does not change.
- **Real SSO / MFA (Gate C).** Today `x-audit-actor-id` is the
  stand-in; Gate C requires an integration with a real IdP.
- **Playwright coverage of slice B/C smoke paths.** Today each milestone
  ships a Node smoke (`apps/web/scripts/m*‑smoke.mjs`). A
  Playwright suite that exercises the **rendered UI** end-to-end
  (especially the 360 px mobile layout, FR-09 in admin views) would
  complement the data-layer assertions.
- **Accessibility review of the production pages.** `/welcome`, `/quiz`,
  `/admin/synergies`, and `/admin/teams` are good candidates for an a11y
  pass (focus order, contrast, screen-reader labels on the `<Mascot>`
  SVGs).
- **Phase 3 (PRD §18) — cross-client benchmark knowledge base, cohort
  analytics, optional native mobile apps.** Not started.

## 8. File-system layout

```
docs/
├── INDEX.md          ← this file (map contract)
├── PRD.md            ← product requirements (35 sections)
├── ROADMAP.md       ← milestone / phase / gate state
└── adr/
   ├── 0001-license-and-stack.md
   ├── 0002-monorepo-tooling.md
   ├── 0003-postgres-migrations-and-rls.md
   ├── 0004-mobile-web-survey-stack.md
   ├── 0005-admin-engagements-page.md
   ├── 0006-local-dev-runner.md
   ├── 0007-ai-pipeline.md
   ├── 0008-auditor-review.md
   ├── 0009-opportunity-register.md
   ├── 0010-sponsor-onboarding.md
   ├── 0011-cross-team-synergy.md
   ├── 0012-synergy-admin-surface.md
   ├── 0013-quiz-badges-and-mascots.md
   ├── 0014-quiz-form-and-result.md
   └── 0015-team-badge-rollup.md
```

The contract map of every Zod schema and TS type in `@evolai/contracts`
lives at [`packages/contracts/src/contracts-map.md`](../packages/contracts/src/contracts-map.md).
