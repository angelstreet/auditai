# TASK-L — Standard component library and UI rules across the whole app (model: opus)

Owner feedback on the live login page (dark mode): it looks ugly and hand-made: low contrast (navy button on
near-black), two text buttons for the language, plain inputs. The owner wants something standard, with icons
(for example a language icon, not two buttons), and wants the UI/UX rules written once so they never have to be
repeated. The rules are in **docs/UI_RULES.md** (generalised from VirtualPyTest `UI_STYLE.md`). Read it first,
then ADR 0025 and 0027 and docs/UX_AUDIT.md.

## Ground rules

- Public repo: no secrets. Own worktree + branch. Owner rule: merge to main yourself when gates pass
  (`format:check`, `lint`, `typecheck`, `test`, `leak-scan`, `style-guard`, Playwright incl. axe and keyboard) and
  confirm main CI green. Every push to main auto-deploys to production at https://www.evolai.io, so land the work
  in several small merges, respondent and login first, and verify each deploy is READY. ADR for the decisions.
  Do not ask questions. End with `STATUS: ...`.
- Do not remove the single-use survey link flow, the one-tap-per-question behaviour or the French/English text.

## Do

1. **Adopt MUI + Outlined icons** (`@mui/material`, `@mui/icons-material`, emotion, Next 14 app-router setup with
   the registry/SSR cache so there is no flash of unstyled content). Build one theme in `packages/ui` from the
   existing tokens (palette navy/teal/blue/amber/off-white/slate, derived tones already approved, Inter
   self-hosted, 400/600). Provide **light and dark** themes that follow `prefers-color-scheme` and a manual toggle
   (icon button, stored in a cookie so there is no flash). Fix the contrast problems in both: primary = filled
   teal with the right on-accent text colour; test every pair for AA with a unit test.
2. **Rebuild the shared chrome with standard patterns**: header (logo, "About" and "Privacy" as links, language as
   a **globe icon button with a menu**, theme toggle icon, account/login icon; hamburger menu on phones), footer,
   page container. Language and theme controls have tooltips and aria-labels and keep the same size in French and
   English.
3. **Restyle the login page first**: MUI text fields with labels, email field with autocomplete, password field
   with show/hide eye icon, one primary "Se connecter / Sign in" button (loading state), clear inline error,
   centred card, works in light and dark. Then the **respondent flow** (welcome, survey start, one-question
   screens with big option buttons and a visible progress bar, done and return pages, quiz), then **admin**
   (tables, forms, tiles, dialogs) and the landing pages in `landing/` that are still live-facing.
4. **Icon registry**: `packages/ui/src/icons.tsx` with one Outlined icon per meaning (the VirtualPyTest list in
   its UI_STYLE section 14 is the model: success, error, warning, info, running, pending, search, close, add,
   delete, edit, refresh, settings, globe, lock, visibility, theme light/dark, language, account, back, menu,
   download, copy ...). `<AppIcon name=... />`. No emoji in the UI.
5. **Components once**: `StatusText` (icon + word), `PageTitle`, `StatTiles`, `SettingRow`, `EmptyState`, segmented
   toggle, confirm dialog, snackbar helper, skeletons. Pages use these and theme overrides only.
6. **Extend `scripts/style-guard.mjs`** (and its test) to the new rules: no hex/rgb literal, no literal font-size,
   no emoji in `apps/web/src` and `packages/*`, no `color="success|error|warning|info|secondary"` on buttons,
   at most one `variant="contained"` per page component (heuristic, allow-list with reason), icon imports only
   through the registry. Wire it into CI as before.
7. **Verify visually and automatically**: Playwright screenshots (kept out of git) of login, welcome, a survey
   question, done, quiz, admin data, admin tables in light and dark at 360 and 1280, fr and en; axe zero
   serious/critical; keyboard run still passes; contrast test; no layout shift when switching language/theme
   (assert element bounding boxes of header controls are equal across locales). Update the tap-count and jargon
   tests if markup changed.
8. **Docs**: link docs/UI_RULES.md from README, AGENTS.md ("read before touching any screen") and
   docs/HANDOVER.md; update docs/UX_AUDIT.md with the change log.
