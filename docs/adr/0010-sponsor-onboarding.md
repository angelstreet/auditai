# 0010 - Sponsor onboarding + portfolio board (M12)

- Status: Accepted
- Date: 2026-10-15
- Deciders: maintainers
- Related: [0001](0001-license-and-stack.md), [0003](0003-rls-and-tenant-isolation.md), [0005](0005-admin-data.md), [0007](0007-ai-pipeline.md), [0008](0008-auditor-review.md), [0009](0009-opportunity-register.md)

## Context

Phase 2 produced the read-and-write surfaces for the auditor (M10) and the
opportunity workflow (M11). The client sponsor (and the team manager) had
no in-product surface of their own; their first interaction was an
email-to-the-consultant, a manual Zoom call, and a CSV exchange.

The deliverable for M12 is two new surfaces:

1. A **sponsor intake** that captures the client-side knowledge the audit
   needs to scope the work: the top-priority workflow, the departments in
   scope, the data sensitivity boundary, the budget envelope, the
   on-site appetite, the security posture (model regions, data residency,
   prompt-injection review), and a three-axis AI-maturity self-assessment.
2. A **portfolio board** that aggregates every engagement, every team
   card, every opportunity, and every sponsor brief into a single
   five-column kanban (intake → field → review → opportunities → delivery).

The mockup was published at https://6d1x9rnp43nba.space.minimax.io so the
shape of the flow is concrete before any data model lands.

## Decision

### 1. The `sponsor_briefs` table (migration `0007_sponsor_briefs.sql`)

```
sponsor_briefs(
  id, tenant_id, sponsor_user_id NULLABLE,
  top_priority_workflow,
  departments_in_scope JSONB,
  data_sensitivity_boundary JSONB,
  annual_budget_eur NULLABLE,
  onsite_appetite NULLABLE CHECK IN ('full_pilot','limited_team','remote_only'),
  approved_model_regions JSONB,
  data_residency JSONB,
  prompt_injection_review NULLABLE CHECK IN ('external_auditor','internal','none_yet'),
  leadership_literacy, operational_adoption, policy_governance (each NULLABLE 0..5),
  created_at, updated_at
)
```

- The intake is **append-only** in practice: a re-submission writes a new
  row; the board and the live summary show the most recent one. A future
  M12.x can add a "superseded_by" column for explicit chains, but the
  append-only pattern is enough for the pilot.
- Every column is tenant-scoped and RLS-gated. The auditor / sponsor
  never reads another tenant's brief. The board uses a service-account
  read to aggregate across the analyst and the sponsor memberships.
- The three maturity axes are nullable so a sponsor can submit a brief
  without rating themselves. The auditor can fill in the calibrated value
  later from the analysis results.

### 2. The contracts

`sponsorBriefSchema` (wire shape) and `sponsorBriefWriteSchema` (form
payload) are exported from `@auditai/contracts` alongside the existing
schemas. The enums are explicit (`sponsorDepartmentSchema`,
`sponsorSensitivitySchema`, `sponsorOnsiteAppetiteSchema`,
`sponsorModelRegionSchema`, `sponsorResidencySchema`,
`sponsorPromptInjectionReviewSchema`, `maturityScoreSchema`) so the
options list in the UI is generated from the same source as the validator
in the server action. 6 new tests, 92 contracts tests total.

### 3. The web surface

```
apps/web/src/app/
  welcome/page.tsx         animated hero + "Start the intake" CTA
  intake/page.tsx          form (4 sections) + live summary sidebar
  intake/IntakeForm.tsx    client form with chip-based multi-select
  intake/actions.ts        saveSponsorBriefAction server action
  board/page.tsx           5-column kanban aggregating everything
apps/web/src/lib/sponsorBriefData.ts
  createSponsorBrief       (withTenant, writes one row)
  getLatestSponsorBrief    (withTenant, ORDER BY created_at DESC LIMIT 1)
  listLatestSponsorBriefs  (withServiceAccount, DISTINCT ON tenant_id)
```

- The intake form posts to a server action that calls
  `sponsorBriefWriteSchema.safeParse` first; the data layer casts directly
  to the row shape (same pattern as M11) because the synthetic seed's
  UUIDs are not v4.
- The live summary is rendered on the right column of the intake page
  with the current `getLatestSponsorBrief` result, so the sponsor sees
  their previous submission while editing a new one.
- The board aggregates engagements (per tenant), opportunities (per
  engagement), and the latest brief per tenant. Status pills are the only
  visual element; no raw numbers appear on the surface.

### 4. Service-account boundary (PRD §25.1)

The board reads across tenants because the same consultancy platform may
serve many tenants; the page itself is read-only and never accepts user
input. The `listLatestSponsorBriefs` query runs with
`app.is_service_account = 'on'`, which the M4 RLS policy permits. The
intake form's server action runs under `withTenant` so the RLS policy
gates it to the actor's tenant.

The actor resolution mirrors the M10/M11 pattern: the `x-audit-actor-id`
header is honoured if present (tests / staging), otherwise the first
`auditor` membership of the tenant. Gate C (SSO + MFA) replaces the
fallback with the real session.

### 5. Privacy and retention

The brief carries no PII. The only identity is the optional
`sponsor_user_id` FK, which is nullable so a draft can exist before the
sponsor membership is wired up. The retention policy is the tenant's
default; no special retention rule for the brief. PRD §15 forbids
unnecessary personal data, so a future M12.x can drop the
`sponsor_user_id` column entirely if the SSO rollout removes the need for
a platform-internal sponsor identity.

### 6. The portfolio board and the gamified badge system (M14)

The board's per-team card is the read surface for the M14 mascot badges.
M14 will add a `respondent_badges` + `team_badges` table keyed by
`respondent_pseudonym`, and the team card will show the dominant mascot
(Tortoise / Fox / Owl) instead of the current raw status. The board's
column structure (intake → field → review → opps → delivery) is the
same in M12 and M14; M14 is a presentation-layer change, not a data-
model change.

## Consequences

- The client sponsor / team manager has an in-product surface for the
  first time. The intake captures the data the audit needs to scope the
  work without a back-and-forth email chain.
- The portfolio board is the single read surface for the consultancy:
  every engagement, every team, every opportunity, every sponsor brief,
  aggregated into a five-column kanban. The team-card upgrade for M14
  is contained to the card component.
- The intake is append-only; "edit the brief" is a future M12.x. The
  current model lets the audit show a sponsor the history of every
  brief the sponsor submitted, and the consultant sees the same history
  during the call.
- The board's read path uses the service-account role, which is the
  same pattern M4 / M5 / M6 already use for cross-tenant reads. The
  RLS policies on the new tables honour the flag.
- The mockup at https://6d1x9rnp43nba.space.minimax.io is now backed
  by a working web page; the next PR for the same milestone will
  replace the static hero with a real product.

## Alternatives considered

- **Edit-in-place on the brief.** Rejected: the append-only pattern keeps
  the audit trail simple and lets the consultant show a sponsor the
  history of every change. A future M12.x can add a "superseded_by"
  column for explicit chains.
- **Combine `sponsor_briefs` with `engagements`.** Rejected: the brief
  is the sponsor's point of view (what they want AI to improve); the
  engagement is the consultant's point of view (how the work is scoped).
  Combining them loses the per-role voice and makes the table much
  harder to read.
- **A separate "team intake" page per team.** Deferred to M13 (cross-team
  synergy detection). For M12, the team scope is captured inside the
  single brief and surfaced on the board.
- **Per-axis bench bars on the board cards.** Rejected for M12: the
  M14 mascot system replaces raw bench bars with the Tortoise / Fox /
  Owl mascots. Adding the raw bench now would be throwaway work.
- **A multi-tenant intake with cross-tenant sign-off.** Rejected: the
  PRD scopes each tenant to a single consultancy engagement. Cross-tenant
  briefs are a Phase 3 feature.
