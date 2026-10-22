# 0048 — Brand kit as the source of brand and tokens, and the teal contrast rule

Status: accepted

## Context

The brand kit ("Adaptive Steps", `apps/web/public/brand/kit/`) was added without being applied: the header drew a
home-made logo, the sign-in card repeated it, the favicon and Open Graph image were home-made, the header carried
About and Privacy links, and the staff and public pages named the consultancy "auditor". The independent review
(`docs/FABLE_REVIEW_2026-10-22.md` §6, §7) asked for one standard chrome and for a contrast rule for teal.

Teal `#19A999` on white and white on teal are both about 2.9:1, which fails WCAG AA for text.

## Decision

- **The kit is the source** of logo, icons, Open Graph images, manifest and colours. Nothing in `public/brand` is
  home-made; the `Logo` component draws the kit symbol (three steps) with the wordmark as live Inter text, so no
  fallback font is involved. Light and dark follow the theme through tokens.
- **Tokens** (light and dark, `packages/ui` CSS and MUI palette, kept in step by `tokens.test.ts`): ink `#172B3A`,
  teal `#19A999`, blue `#4A7FE8`, apricot `#FFB86A` (small accents only), cloud `#F7FAFC`, slate `#536575`.
- **Contrast rule.** Raw teal is for fills, icons and large graphics, never small text. Small text and links on
  light use the darker teal `--color-accent-ink` (`#0F7A6E`, measured above 5:1 on white). The filled primary
  button on light is white on that darker teal; on dark it is ink text on teal. Teal on ink passes and is used there.
  `tokens.test.ts` asserts all of these, and that raw teal on white stays below 4.5:1 so nobody uses it for text.
- **One chrome.** One shared header (kit lockup left; FR | EN toggle, theme icon, sign-in or account control
  right) and one slim footer (symbol, licence line, Privacy, Source) on every page; the lockup appears once per page.
  The About page is removed (`/about` redirects to `/`); the front page is one card without mascots.
- **Words.** The consultancy is "EvolAI" / "l'équipe EvolAI" in every user-readable string. The `auditor` role stays
  a code identifier. `packages/i18n/src/jargon.test.ts` fails when auditor, auditeur or consultant appears in any
  catalog string.

## Alternatives

- Teal for text with a larger size: rejected, small text is everywhere (links, captions).
- Changing the kit teal: rejected, the kit is the brand; the darker token is a text tone, not a new brand colour.
- Keeping About for the public: rejected by the review; the front page is the About.

## Consequences

- New screens use tokens only; a teal text colour that is not `accent-ink` fails review and the contrast test.
- The `auditor` role name can change in code later without touching copy.
- The kit SVGs still use a fallback font for their own text; the app does not use those files for the wordmark.
