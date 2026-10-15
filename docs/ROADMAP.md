# EvolAI — Roadmap

> Single source of truth for delivery. Mirrors [PRD §18](PRD.md#18-rollout-phases-timelines-and-gates);
> the public copy of the PRD is anonymised ("the pilot client"); this roadmap never refers to a real client.

Each milestone below is delivered as its own branch and pull request against `main`. CI must be green
before merging. After a merge the **State** column and the README's **Status** block are updated in the
next commit on `main` (or in the merging PR).

## Phase 1 — Pilot MVP foundation (PRD §18)

Goal: multi-tenant foundation, mobile survey, deterministic literacy scoring, AI brief skeleton, opportunity
register skeleton. Maps to **FR-01 to FR-06**.

| #   | Milestone                                  | Owner block | PRD §          | State | Done when                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------ | ----------- | -------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Roadmap                                    | —           | §18            | done  | `docs/ROADMAP.md` committed, merged, referenced from README.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| M2  | Monorepo bootstrap + CI                    | infra       | §12, §13, §17  | done  | pnpm + Turborepo workspace, TS strict, lint + format configs, GitHub Actions install/lint/typecheck/test, leak scan (secrets, IPs, e-mails, banned client terms) green.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| M3  | Domain + contracts packages                | domain      | §11, §14       | done  | Zod schemas + TS types for tenant/org/department/team/membership/role/audit-engagement/survey-template/version/question-item/invitation/respondent/submission/answer with ≥90% line coverage on each package.                                                                                                                                                                                                                                                                                                                                                                                   |
| M4  | Database migrations + RLS + isolation test | infra       | §15, §16, §33  | done  | Postgres migrations for M3 entities, every tenant table has `tenant_id` + RLS, automated cross-tenant deny test (`tests/db`) fails when a tenant query returns another tenant's rows.                                                                                                                                                                                                                                                                                                                                                                                                           |
| M5  | Employee mobile web survey skeleton        | apps/web    | §5, §16        | done  | Next.js app, secure invite token (HMAC + expiry + single-use), privacy notice, one question per screen, progress, FR/EN, resume; Playwright test at 360 px wide asserting no horizontal scroll and no clipped labels.                                                                                                                                                                                                                                                                                                                                                                           |
| M6  | Admin engagements page                     | apps/web    | §9 (FR-01, 09) | done  | Server component lists audit engagements with completion counts (synthetic seed); page does not leak rows across tenants; Playwright smoke test for the route (mobile-360 + desktop-admin projects).                                                                                                                                                                                                                                                                                                                                                                                            |
| M7  | One-command local runner + smoke           | infra+web   | §12, §17, §18  | done  | `pnpm local:up` boots embedded Postgres 17 + applies M4 migrations + serves the production Next.js build on a free port; `pnpm local:smoke` walks the survey end-to-end and asserts the submission count increased; `pnpm local:status` reports both sides; ADR 0006 captures the design and trade-offs.                                                                                                                                                                                                                                                                                        |
| M8  | EvolAI rebrand + public landing page       | apps/web    | §12, §18       | done  | Replace the `auditAI` wordmark with the EvolAI adaptive-steps logo + tagline; add a `<Logo>` component + brand colour tokens; ship a public static landing page on `space.minimax.io` that mirrors the brand; update README / SECURITY / CONTRIBUTING / ROADMAP to the new name.                                                                                                                                                                                                                                                                                                                |
| M9  | AI pipeline worker (rule-based first cut)  | services/ai | §10, §26.2     | done  | `analyses` table with RLS + denormalised counters + `model_route` + `evidence_json`; `@auditai/ai` package with `runPipeline` (`classifySensitivity`, `extractThemes`, `findContradictions`, `buildInterviewPrompts`) + a `pg`-backed `processSubmission` / `processAllSubmitted` worker; `pnpm --filter @auditai/ai run smoke` runs the worker end-to-end against the local stack and reports `processed=N failures=0`; every claim carries `sourceKind` + `sourceId` + `quote`; LLM-backed implementation is a future swap of the four `synthesize*` functions; ADR 0007 captures the design. |

## Phase 2 — Audit operations (FR-07 → FR-14)

Detailed milestones to be drafted once Phase 1 is merged. The next Phase 2 milestone is the auditor review UI (M10 / M11) which will read the `analyses` rows produced by M9 and gate publishing on human approval. It will also cover the opportunity register, retention/deletion workflow, training recommendations and on-site process maps.

## Phase 3 — Intelligence (FR-15 → FR-17)

To be drafted after Phase 2 sign-off. Covers authorised cross-client benchmark knowledge base,
cohort analytics, optional native apps.

## Gates (PRD §25.4)

- **Gate A — survey pilot:** tenant isolation, retention, audit logs, approved AI data route.
- **Gate B — AI synthesis:** redaction, prompt-injection tests, source traceability, model cost ceiling.
- **Gate C — enterprise hosting:** recovery drill, SSO/MFA, penetration test, agreed SLA.
- **Gate D — cross-company benchmarks:** aggregation thresholds, de-identification review.

Each milestone explicitly records which gates its tests advance and which it does not.

## Conventions

- Branches: `m<number>-<short-name>` (e.g. `m2-monorepo-ci`).
- One pull request per milestone; PR title prefixed with `[M#]`.
- Record every significant technical choice as a new ADR in `docs/adr/`.
- Synthetic fixtures only; never commit credentials, IPs, hostnames, e-mails or client names.
