# 0033 - MUI component library, light and dark theme, standard chrome and identity

- Status: Accepted
- Date: 2026-10-18
- Related: [0025](0025-design-tokens.md), [0027](0027-one-font-and-playwright-in-ci.md), [0023](0023-auditor-auth-and-session.md), [UI_RULES](../UI_RULES.md), [UI_GLOWUP_PLAN](../UI_GLOWUP_PLAN.md)

## Context

The owner's live reviews found the UI hand-made: low contrast in the browser's dark mode (a navy button on
near-black), two text buttons for the language, plain inputs, no identity after sign-in, a 3-line welcome
headline with a capitals pill, and developer copy on admin screens. Every control was a CSS class in a
968-line `globals.css`. UI_RULES §0 asks for a standard component library and the patterns users already know.

## Decision

1. **MUI 7 (`@mui/material` 7.3.11) with the Outlined icon set**, emotion, and
   `@mui/material-nextjs/v14-appRouter`'s `AppRouterCacheProvider`, which collects styles during server
   rendering so there is no flash of unstyled content. MUI 7 rather than the current 9.x: its API is the one
   this app is written against, it supports Next 14 and React 18, and 9.x had been out under two weeks.
2. **One theme in `packages/ui/src/theme.ts`**, built from `palette.ts`. It uses CSS-variable colour schemes
   (`cssVariables`, `colorSchemeSelector: [data-theme="%s"]`), so light and dark are both in the stylesheet
   and switching is an attribute change. Typography is a role scale (`pageTitle`, `sectionTitle`,
   `cardTitle`, `lede`, body, caption); weights are 400 and 600; buttons are not upper-cased; ripple is off;
   touch targets are 44 px.
3. **Colour has two sources that are tested to agree.** MUI needs real values to derive hover and disabled
   tones, so they live in `palette.ts`. The CSS custom properties in `tokens.css`, still used by
   `globals.css` and `landing/`, carry the same values, with a light `:root` set and a
   `[data-theme='dark']` set; a `prefers-color-scheme` media copy covers pages without the attribute.
   `tokens.test.ts` fails on any drift, and checks every text/background pair at 4.5:1 and every
   edge/focus pair at 3:1 in both schemes.
4. **Dark is not black** (UI_RULES §12): page `#1a1d23`, cards `#262a33`, raised `#2f3440`, text `#e8ebf0`,
   muted `#a0a8b5`. The primary action is filled teal in both schemes: `#0f7a6e` with white text in light,
   `#2ec4b2` with navy text in dark. The logo wordmark follows the text colour.
5. **The theme choice is a cookie (`evolai_theme`)**, not localStorage. The server renders
   `<html data-theme>` from it, so an explicit choice never flashes. Without a cookie, a 1-line inline
   script in `<head>` sets the attribute from `prefers-color-scheme` before the first paint (the CSP
   already allows inline scripts, ADR 0032). MUI's own storage is off (`storageManager={null}`) and the
   cookie seeds `defaultMode`, so there is one source of truth.
6. **Standard chrome.** The header has the logo, About and Privacy as links (a growing underline on hover),
   a globe icon button with a language menu, a sun/moon theme icon and an account control. The links fold
   into a hamburger on phones. Every control is a 44 px icon button with a tooltip and an aria-label, and is
   the same size in every locale. A footer carries the trust line and the links.
7. **Identity after sign-in** (UI_RULES §11). The account control shows the initials avatar and the name,
   and opens a menu with name, email, role, organisation, switch organisation (only when there is more
   than one), workspace and sign out. The session payload gains an optional `email`: the address typed at
   sign-in, normalised. The database keeps only its digest, so the signed cookie is the only place the
   plain address exists. The cookie is httpOnly and the address is the user's own; older cookies without
   it still verify.
8. **Icons through one registry** (`packages/ui/src/icons.tsx`, `<AppIcon name=… />`), one Outlined icon per
   meaning. **Shared components** live in `packages/ui/src/components.tsx`: `PageTitle`, `IconTile`,
   `StatTiles`, `StatusText`, `SettingRow`, `EmptyState`, `SegmentedToggle`, `ConfirmDialog`,
   `NotifyProvider`/`useNotify` and `SkeletonRows`.
9. **Migration is incremental.** `globals.css` stays for the pages that have not moved yet, and it now reads
   the scheme-aware tokens, so every page gets the dark palette at once. Pages move to MUI components in
   small merges (UI_GLOWUP_PLAN §6).

## Alternatives

- **Keep hand-written CSS and add a dark token set only.** It fixes contrast but not the hand-made look, the
  missing standard patterns (menus, dialogs, snackbars, password eye) or the owner's request.
- **Tailwind + headless components (Radix or shadcn).** Lighter at runtime, but every standard pattern is
  still assembled by hand, and the owner's other product (VirtualPyTest) already uses MUI, so the rules and
  reviews carry over.
- **MUI `InitColorSchemeScript` with localStorage.** The standard MUI path, but the server cannot read
  localStorage, so an explicit dark choice would flash light on every navigation.

## Consequences

- About 90 kB (gzip) of client JavaScript for MUI and emotion on every page. Icons are imported one by one,
  so only the icons in use ship.
- Two colour sources (`palette.ts`, `tokens.css`), held together by a unit test.
- Style-guard exempts `palette.ts` and `theme.ts` (the token sources). It will also reject direct
  `@mui/icons-material` imports outside the registry, emoji, button status colours and more than one
  `variant="contained"` per page (UI_GLOWUP_PLAN §6, step 5).
