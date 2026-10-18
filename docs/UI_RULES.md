# EvolAI UI rules

One look for every page, dialog and popup, in light and dark. These rules are the owner's standing UI/UX
rules, generalised from the VirtualPyTest guide (`UI_STYLE.md` and its UIUX review) so they do not have to be
repeated. Read this before touching any screen. Design tokens and the font are in
[ADR 0025](adr/0025-design-tokens.md) and [ADR 0027](adr/0027-one-font-and-playwright-in-ci.md); respondent
copy rules are in [UX_AUDIT.md](UX_AUDIT.md).

## 0. Do not reinvent

- **Use a standard component library.** MUI (`@mui/material`) with the Outlined icon set (`@mui/icons-material`),
  themed from our tokens. Text fields, buttons, menus, dialogs, tabs, toggle groups, tooltips, snackbars, tables,
  progress and skeletons are the library's components, never hand-made.
- **Use the pattern users already know.** Language = a globe icon button opening a menu (or a two-option toggle
  when only two languages), not two text buttons. Password = a show/hide eye icon. Close = X icon. Settings =
  gear. Back = arrow. Menu = hamburger on phones. Links look like links, buttons like buttons.
- **Icons over words** for common actions and navigation; always with a tooltip and `aria-label`. Words stay for
  the primary action and anything ambiguous.
- If a component is missing, add it once to `packages/ui` and reuse it. Never a one-off style in a page.

## 1. Tokens

- Never write a hex colour, font size, radius or spacing in a page. Tokens only (`packages/ui/src/tokens.css`
  and the MUI theme built from it). A new need is a new token in both the light and the dark set.
- Light AND dark are first class: the theme follows `prefers-color-scheme`, with a manual toggle (icon button).
  Declare `color-scheme: light dark`. Check every screen in both, with real data, with a longer French string.
- Every text/background pair meets WCAG AA (4.5:1 text, 3:1 large text and control edges). Test it.
- Status colours (success, error, warning) are fixed and never themed; they mean state only, never decoration.

## 2. Type

One font (Inter, self-hosted), two weights (400 and 600). A role scale (page title, subtitle, section title,
card title, body, label, caption, button, table header, code) defined once in the theme; pages read roles,
never literal sizes. No ALL CAPS, no `h4` page titles, buttons are not upper-cased.

## 3. Buttons and roles

| Role      | Use                                | Look                                                |
| --------- | ---------------------------------- | --------------------------------------------------- |
| Primary   | the one main action of a view      | filled accent, one per view                         |
| Secondary | other actions                      | outlined                                            |
| Tertiary  | low-weight actions                 | text button                                         |
| Danger    | irreversible or stops running work | outlined error, filled only inside a confirm dialog |

- Never two filled buttons in a view. Colour is never used to show state; state is an icon plus a word.
- A disabled primary button always says why (tooltip or helper text).
- Mode toggles keep their position, size and style when toggled; only the label changes.
- Touch targets are at least 44 px. Respondent screens: large, thumb-reach buttons.

## 4. Status and feedback

- Status = icon + word ("Done", "Waiting"), never a bare coloured chip. Something still running is neutral
  with a running icon, success only when finished.
- Categorical tags are tinted pills (text colour, light fill, border), never filled primary chips.
- Errors: plain words, say what to do next, next to the field. Empty states: one line telling what to do next.
- Loading: a skeleton the size of the content. Saving: instant feedback, no spinner flash.
- Toasts for confirmations (snackbar), dialogs only when a decision is needed.

## 5. Layout

- Page skeleton: title (with a one-line subtitle for admin pages), key numbers as tiles, then cards.
  Respondent screens: one question per screen, one primary action, progress always visible.
- Cards: surface colour, hairline border, no heavy shadow. Page background differs from the card.
- Lists of rows in one bordered container split by hairlines; hover tint; row actions appear on hover or in an
  overflow menu, never a column of always-visible trash icons.
- Tables: fixed column widths, ellipsis plus tooltip on long cells, tabular numbers, header from the theme.
- Header: logo left, language icon, theme icon, account/login icon on the right; collapses to a menu on phones.
  No bar chrome: same surface as the page.

## 6. Stable layout (no shift, no flashing)

Text that ticks, counters and timestamps get a fixed-width slot with tabular numbers. Controls keep their size
across languages (French is longer: size for it). Navigation and tabs change colour and underline on selection,
never weight, padding or width. Loading and empty states reserve the size of the content. Long text wraps or
ellipsises on purpose.

## 7. Motion and interaction

One hover primitive per control type: nav items get an accent underline that grows; buttons get a tint. No ripple
on bars, no glow, no stacked effects. Respect `prefers-reduced-motion`. Visible focus ring on every control,
using a token. Everything works with the keyboard alone.

## 8. Words (respondent screens)

Plain short sentences, about 12 words. No technical terms (pseudonym, tenant, engagement, synergy, token, audit
as a noun for what the respondent does). One term per concept, same in French and English
(`glossary-fr-en.md`). French uses vouvoiement. Say the time it takes and how far along the person is.

## 9. Icons

One icon per meaning, from one registry (`packages/ui/src/icons.tsx`), Outlined family, 16 or 20 px, inheriting
the text colour. No emoji anywhere in the UI. A new meaning is one new row in the registry, not a new import.

## 10. Checklist before shipping a screen

1. Library components only; the language, theme and account controls are icons with tooltips.
2. No hex, size or spacing literal: `pnpm style-guard` passes (extend it as the rules grow).
3. One primary action. Status as icon + word. Danger only for irreversible actions.
4. Looked at in light and dark, 360 and 1280 px, French and English, with real data.
5. Axe and keyboard Playwright checks pass; contrast test passes.
6. Nothing shifts when data, time or language changes.
7. Respondent screens pass the jargon test and the tap-count test.

## 11. Identity and orientation (added after the first live review)

After sign-in the user must always know who they are, where they are and how to leave. The header shows an
avatar/initials button with the name (or email), role and current organisation, opening a menu: profile, switch
organisation, theme, language, sign out. The current section is marked in the nav and every page has a title. A
signed-in screen is never anonymous.

## 12. Dark mode is not black

Page about `#16181d` to `#1c1f26`, cards one step lighter (`#232730` to `#2a2f3a`), hairline borders, text
`#e8ebf0`, muted `#a0a8b5`, accent lightened a little. Never a near-black page with navy-on-black buttons: the
primary action is the filled teal accent in both themes. Elevation is a lighter surface, not a shadow. Measure
contrast in code.

## 13. Hierarchy, headings, copy length (glow-up rules)

- Headings: at most 2 lines on desktop. Use `text-wrap: balance`, a max width of about 20 to 24 characters per
  line, one alignment axis for the whole screen. If a title needs three lines, shorten it.
- No shouting eyebrow pills in capitals above titles.
- Cards: an icon tile as the lead, a title, one line of text (two at most). Three lines of card text means the
  copy is wrong: cut it.
- The primary button is never glued to the cards above it: at least 24 px of space, aligned to the same edge.
- Welcome and landing pages look like a product: short headline, one-line subtitle, one primary action and one
  secondary link, a visual (mascot or screenshot), three or four benefit tiles, a trust line, a footer. Not a
  document.
- A global skill `web-ui-ux-rules` carries these rules for every project; this file overrides it where it is
  more specific.
