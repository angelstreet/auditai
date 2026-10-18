# 0036 - /intake behind sign-in, tenant from the session, and a route inventory

- Status: Accepted
- Date: 2026-10-18
- Related: [0010](0010-sponsor-onboarding.md), [0023](0023-auditor-auth-and-session.md), [0035](0035-view-as-and-client-referent-surface.md)

## Context

The live `/intake` page was reachable by anonymous visitors. It picked the tenant from `?tenant=` or, failing
that, the first tenant in the database, and showed that tenant's latest sponsor brief (goals, budget, security
answers). Its server action took the tenant from a hidden form field and wrote with no session. `/quiz` had the
same shape: it wrote a badge to the first tenant for any anonymous caller. The middleware matcher covered only
`/admin`, `/board` and `/client`.

## Decision

1. `/intake` joins the middleware matcher: no session means a redirect to `/login?next=/intake`.
2. The page and the action take the tenant from the signed session only (`pickTenant(session, undefined)`, the
   first admin-capable tenant). A `tenant` query value or a `tenantId` form field is ignored; the hidden field is
   removed. The action goes through `resolveActor`, so view-as stays read only and membership is checked again.
   Referents are sent to `/client` (they have no intake).
3. `/quiz` and `/quiz/result` become tenant-free: the demo scores the answers and shows the tier carried in the
   URL, and stores nothing. The stored quiz is `/s/[token]/quiz`, where the signed invitation fixes tenant and
   pseudonym. `/welcome` no longer reads the database.
4. `apps/web/src/routeAccess.json` lists every page and route handler that the matcher does not gate, with an
   access class and a reason. `routeInventory.test.ts` walks `src/app` and fails when a route is neither gated
   nor listed, or when an entry is stale or has no reason.

### Inventory (outside `/admin`, `/board`, `/intake`, `/client`)

| Route                                                                    | Who may reach it                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `/`, `/welcome`, `/about`, `/privacy`, `/login`, `/quiz`, `/quiz/result` | Anyone; no tenant data                                        |
| `/s/[token]` and sub-pages, `/api/answer`, `/api/locale`                 | Holder of a signed invitation token; own tenant and pseudonym |
| `/api/auth/login`, `/api/auth/logout`, `/api/health`                     | Anyone; no tenant data                                        |
| `/api/cron/*`                                                            | `CRON_SECRET` bearer                                          |
| `/api/admin/invitations`, `/api/view-as`                                 | Session checked in the handler (403 or 401 otherwise)         |

Only `/intake` and the quiz exposed or wrote tenant data anonymously; the rest was already correct.

## Alternatives

- Keep `/intake` public for sponsors with a signed link: no sponsor flow exists yet; a token-scoped intake can be
  added later as its own route and allow-list entry.
- Resolve the tenant for multi-tenant staff with a selector: out of scope; the first permitted tenant is used, as
  in `/admin`.

## Consequences

- Anonymous requests to `/intake` get a redirect and no brief text. Tenant A can neither read nor write tenant
  B's brief (RLS plus session scoping; DB test in `tests/db/src/sponsorBriefs.test.ts`).
- The public quiz no longer feeds team badges; only invitation quizzes do.
- No migration.
