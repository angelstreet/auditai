# ADR 0005 \u2014 Admin engagements page

Status: proposed (2026-10-14). Created as part of M6 ([roadmap](../ROADMAP.md)).

## Context

PRD FR-01 and FR-09 require an admin view that lists audit engagements and their completion counts. Phase 1 ships a server component backed by synthetic in-memory fixtures; Phase 2 replaces the data layer with a Postgres query that joins `engagements`, `invitations` and `submissions` (the tables already exist from M4).

## Decisions

- **Synthetic fixtures:** `apps/web/src/lib/adminData.ts` exposes `listEngagements(tenantId)`, `summariseEngagement`, `listTenantIds`, and `tenantLabel`. Two tenants, each with one engagement and eight invitations. Counts are computed in pure TypeScript so the page is testable without a database.
- **Routing:** `/admin/engagements` accepts a `?tenant=<uuid>` query parameter. An unknown value redirects to the default tenant. The page itself calls `listEngagements(tenantId)`, which only returns rows whose `tenant_id` matches; there is no client-side filter that could leak.
- **Server component:** the page is a Next.js Server Component so the data is fetched on the server and the response is a complete HTML table. The tenant switcher is a `<Link>` that re-fetches with a different query parameter.
- **Accessibility:** the table uses `<th scope="col">` and `<th scope="row">` so screen readers announce both axes; the tenant switcher exposes `aria-current="page"`; the overall completion line uses a single `<strong>` percentage.
- **Style:** the admin section uses the same colour palette as the survey but widens the container to 960 px so a desktop admin can read the table without horizontal scrolling.
- **Smoke test:** Playwright with two projects: `mobile-360` (regression \u2014 the admin page must not break the 360 px survey path) and `desktop-admin` (the actual admin route). The desktop test asserts row counts, computed completion percentages, tenant switching and the unknown-tenant redirect. The mobile suite cross-checks that the admin route does not regress the survey clipping invariant by visiting `/admin/engagements` from the mobile viewport.

## Alternatives

- **Static export with client-side filtering:** rejected. Client-side filtering requires shipping every tenant's data to the browser, which violates the cross-tenant deny rule.
- **GraphQL/REST admin API:** deferred to Phase 2. M6 keeps the data layer in the same Node process.
- **Tailwind for the admin section:** Tailwind is the right call once the admin grows beyond one table. M6 ships plain CSS to stay consistent with M5 and keep the deliverable small.

## Consequences

- Phase 2 must replace `listEngagements` with a Postgres query that respects the RLS policies from M4. The function signature is the contract.
- New completion metrics (median completion time, drop-off by screen, etc.) are added in Phase 2 alongside the AI extraction work; M6 deliberately keeps the table to nine columns so the smoke test stays focused.
- The synthetic tenant ids and engagement ids must stay obviously fake (`AGENTS.md`) so the leak-scan allowlist remains narrow.
