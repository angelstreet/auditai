# 0025 - Design tokens, type scale and a style guard (TASK-E)

- Status: Accepted
- Date: 2026-10-18
- Deciders: maintainers
- Related: [0024](0024-i18n-fr-en.md), [0019](0019-public-routes-playwright.md), [0017](0017-board-integration-and-landing.md), PRD §5, §16, [UX audit](../UX_AUDIT.md)

## Context

The UX audit (TASK-E) found styling spread over `globals.css`, per-page `<style>{…}` blocks in 11
files, inline `style={{…}}` props and four landing pages with their own `:root` palettes. In the web
app (mascot artwork aside) there were 17 distinct hex colours (10 off the brand palette) and 17
distinct font sizes (10px to 36px, in px, rem and unitless), and buttons came in four looks. The live
landing pages added 25 hex values and 22 font sizes. Some page-level CSS leaked: `/admin/data` turned every `.btn-primary` on the page
red because the delete form's `<style>` redefined the class. Teal text and white-on-teal pills failed
WCAG AA (2.8:1 to 2.9:1). Admin pages sat in a 360px column on desktop because their wide `section`
was nested inside the narrow layout `main`.

## Decision

1. **One token file**: `packages/ui/src/tokens.css` (exported as `@auditai/ui/tokens.css`) defines
   the brand palette from `landing/brand/brand-kit.png`, a few derived tones, semantic roles,
   one font family, seven sizes, three weights, a 4px spacing scale, radii, shadows and layout widths.
   The web app imports it at the top of `globals.css`. Landing pages link a byte-identical copy at
   `landing/brand/tokens.css` (they are static, no build step).
2. **Semantic roles over palette names** in components: `--color-fg`, `--color-muted`,
   `--color-surface`, `--color-accent`, `--color-highlight`/`--color-on-highlight`, `--color-danger`.
3. **Derived tones only where the brand colour fails its job** (owner review):
   `--color-teal-ink` `#0f7a6e` (teal text, 5.2:1), `--color-border-strong` `#8796a5` (form-control
   edge, 3.0:1, WCAG 1.4.11), `--color-danger` `#b42318` (errors and destructive buttons, 6.6:1). Teal
   stays a fill colour; text on teal is navy (5.0:1), not white (2.8:1).
4. **Type scale**: `xs` 12, `sm` 14, `base` 16, `lg` 20, `xl` 24, `2xl` 32, plus `3xl`
   `clamp(36px, 5vw, 56px)` for the landing hero only. `h1` is `xl` on phones and `2xl` on wide pages,
   `h2` `lg`, `h3` `base`. Font family `Inter` with the system stack as fallback. The landing page
   loads Inter. The web app does not, so slow phones make no extra font request.
5. **Shared components as classes in `globals.css`**: `.btn` + `.btn-primary` / `.btn-secondary` /
   `.btn-danger` / `.btn-sm`, `.link-button`, `.card`, `.card-list`, `.field`, `.chip`, `.pill-*`,
   `.dl-grid`, `.stack`, `.step-bar`, `.progress`, `.option-button`. Global form-field styles give every
   input, select and textarea the same height (44px), edge and radius.
6. **Layout**: the layout `main` is the narrow column (480px). A page whose root element has class
   `wide` widens it to 1120px (`main.container:has(> .wide)`). Pages no longer nest their own `main`.
7. **Guard**: `scripts/style-guard.mjs` (`pnpm style-guard`, CI job "ci") fails on a hex colour or a
   font-size literal outside the token file, on a per-page `<style>{` block in TSX, and when the
   landing copy of the tokens drifts. Exempt files are listed in the script with a reason (mascot
   artwork, two archived mockups). `packages/ui/src/tokens.test.ts` checks the brand values and the
   AA contrast of every text/background role.

## Alternatives considered

- **Tailwind or CSS-in-JS**: more tooling than a small app needs. The respondent bundle stays plain
  CSS, as ADR 0004 already decided.
- **CSS modules per page**: scoping would prevent the leaks, but each page would still invent its own
  sizes. A shared class set plus the guard keeps pages consistent with less code.
- **Generating the landing copy at build time**: the landing has no build step. A checked copy with
  a byte-equality guard is simpler.
- **Dark mode now**: not in the PRD for MVP. The semantic roles make it a later `prefers-color-scheme`
  block, not a rewrite.

## Consequences

- A new colour or size is a token change in one file (plus `cp` to the landing copy), reviewed in
  one place; the guard rejects one-offs.
- The mascot artwork keeps its own shading colours (exempt). Its sizes still vary by context
  (40/64/120px), which is deliberate.
- Owner decisions pending: the three derived tones above, and whether teal text on landing pages
  should move to `--color-teal-ink` everywhere (done for links on `landing/index.html` only).
