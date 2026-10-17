# 0017 - /board integration + /welcome landing + /admin/data (M15 slice B + improvements)

- Status: Accepted
- Date: 2026-10-17
- Deciders: maintainers
- Related: [0010](0010-sponsor-onboarding.md), [0011](0011-cross-team-synergy.md), [0013](0013-quiz-badges-and-mascots.md), [0015](0015-team-badge-rollup.md), [0016](0016-fr09-retention-export-deletion.md)

## Context

The previous slices put every piece in the right place but each lived
on its own dedicated route: synergies under `/admin/synergies`,
team mascots under `/admin/teams`, sponsor briefs + opportunities +
engagements on `/board`. Slice B of M15 plus the integration
improvements in the backlog list converge everything on `/board` so
the analyst sees the cross-cutting signal in one place. This PR also
turns `/welcome` into the public entry point instead of the static
`/about` page.

## Decision

### 1. `/board` integrates synergies + team mascots

`apps/web/src/app/board/page.tsx` now pulls `listSynergies(tenant)` +
`listTeamBadges(tenant)` in the same parallel block as engagements +
opportunities + briefs. Each synergy becomes a ticket on the
**Auditor review** column with the theme label + mascot tier prefix;
each team badge becomes a ticket on the **Opportunities** column with
the mascot SVG avatar inline.

The mascot SVG component (`<Mascot>` from `@auditai/ui`) is rendered at
size 32 next to the title. The ticket tone is rebound to the tier:
tortoise = supporting, fox = teal, owl = green. The existing tone
colors persist for non-mascot tickets.

### 2. `/welcome` becomes the public landing

`apps/web/src/app/page.tsx` `redirect('/about')` becomes
`redirect('/welcome')`. The M12 sponsor hero is now the first surface
visitors hit on `https://<host>/`. A new smoke script
(`apps/web/scripts/m15b-smoke.mjs`) asserts:

- `GET /` returns a 30x redirect with `Location: /welcome`.
- `GET /welcome` still renders the four-step journey hero + CTA.
- `GET /board` returns the kanban.
- `GET /admin/data` renders the export + erase widgets.

### 3. `/admin/data` (M15 slice B)

The export + retention trail is exposed at `/admin/data`:

- **Export widget** — pick one of the six `ExportKind`s, run the
  `runExport` server action, preview the first 1,200 chars of the
  CSV in a `<pre>` block. The row count + actor are recorded in
  `export_requests`.
- **Erase widget** — enter a respondent pseudonym; runs
  `deletePseudonym`, removes the respondent_badges rows in one
  transaction, writes one `audit_log` + one `deletion_events` row
  per badge.
- **Recent tables** — the last 20 export_requests + the last 20
  deletion_events for the actor's tenant, in `created_at DESC` order.

The read-only tables read through `listExportRequests` +
`listDeletionEvents` from the data layers shipped in slice A.

### 4. Mascot SVG centralisation

The mascot svg implementation was already in `@auditai/ui`. This PR
turns the mascot into the avatar of every tier-tagged item on
`/board`, so the asset path is shared across `/board`, `/admin/teams`,
`/quiz/result`, and future surfaces. No new code in `@auditai/ui`
needed; only the consumers route through the same component.

### 5. The `pnpm m15b:smoke` script

`apps/web/scripts/m15b-smoke.mjs` exercises the four read paths and
asserts the redirect chain. Pure Node; idempotent; no DB writes.

## Consequences

- The portfolio kanban is now the single analyst surface. The
  dedicated `/admin/teams` + `/admin/synergies` pages still exist for
  drill-down.
- The `/welcome` hero is the first thing visitors see; the static
  `/about` page is still available for the invitation-only flow.
- `/admin/data` is the front door for the right-to-erasure flow and
  the export row counter. The next PR can add per-engagement +
  per-tenant wipes without touching this surface.
- The mascot asset path is centralised: any future surface can
  `<Mascot tier=... />` from the same import.

## Alternatives considered

- **Inline `<Mascot>` rendering as image markup per card.** Rejected:
  would duplicate the SVG in three places. The shared component is
  auditable in one PR; any visual tweak happens once.
- **Replace `/board` with a fully data-driven mini-Dashboard widget.**
  Deferred: the kanban is the agreed shape; a dashboard is a later
  slice if the owner requests one.
- **Render `Mascot` on every ticket, not only on tier-tagged ones.**
  Rejected: the tier is a _signal_, not decoration; rendering it on
  every ticket would dilute the meaning and crowd the column.

## What's NOT in this PR

- A scheduled retention worker (PRD FR-09 schedule) — Phase 3.
- Playwright coverage of these routes — follow-up.
- Dockerfile + docker-compose — follow-up.
