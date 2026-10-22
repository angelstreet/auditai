# EvolAI — Adaptive Steps Brand Kit

**Tagline:** Understand. Adapt. Evolve.

Editable, flat SVG branding assets and transparent PNG exports for EvolAI. The icon is an ascending three-step geometric mark, using apricot / blue / teal on navy.

## What's included

- `01_Logos/`: horizontal, horizontal with tagline, stacked, standalone wordmark, black/white monochrome. Light theme variants have transparent backgrounds; dark variants use navy canvases.
- `02_Icons/`: standalone symbol, square app icon, favicon.ico, PNG size exports, maskable icon, Apple touch icon, sample PWA web manifest.
- `03_Splash_Screens/`: mobile (1170x2532) and desktop (1920x1080) screen art, light and dark.
- `04_Social_GitHub/`: Open Graph (1200x630), GitHub README (1600x440), LinkedIn cover (1584x396), slide title cover (1920x1080), GitHub avatar.
- `05_Design_Tokens/`: CSS variables, JSON colors.
- `06_Reference/`: user-supplied brand guide and visual exploration, for context.

## Production notes

1. SVGs are editable and use live SVG text styled with `DejaVu Sans` fallbacks; text may reflow on devices without the font. Before publication, replace typography with a licensed Inter/Manrope setup, and optionally convert final wordmark glyphs to SVG paths.
2. The icon geometry is original to this production pass and _interprets_ the chosen generated concept, rather than being a pixel-perfect vector trace of it.
3. PWA manifest paths are examples: adapt `/icons/` to your app's deployment and copy files there.
4. Favicons at 16px should be reviewed in a browser and simplified if necessary; Android adaptive masks and contrast should be tested on target platforms.
5. Light and dark versions are included. Check actual WCAG text contrasts, physical print sizes, and animation accessibility before launch.
6. These are exploratory assets, not a registered trademark or legal clearance. Check trademark/domain/handle availability, and select the software license independently.

## Recommended usage

- App tile / GitHub avatar: `02_Icons/PNG/evolai_app_512.png`.
- Website navbar: `01_Logos/SVG/evolai_horizontal_light.svg` (light) or `_dark.svg` (dark).
- Favicon: `02_Icons/favicon.ico`.
- Social sharing: `04_Social_GitHub/PNG/open_graph_light.png`.
- App launch: `03_Splash_Screens/PNG/splash_mobile_light.png` and corresponding dark asset.

## Palette

| Color          | Hex     | Role                            |
| -------------- | ------- | ------------------------------- |
| Midnight ink   | #172B3A | trust / text / dark backgrounds |
| Evolution teal | #19A999 | progress / primary accent       |
| Discovery blue | #4A7FE8 | learning / secondary accent     |
| Apricot        | #FFB86A | small warm highlight            |
| Cloud          | #F7FAFC | light background                |
| Slate          | #536575 | supporting text                 |

© No rights clearance asserted. Consult appropriate counsel before adopting as an exclusive trademark.
