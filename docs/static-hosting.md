# Static hosting for `landing/`

The pages under `landing/` are plain HTML with no build step. Any static host can serve
them. This guide is provider-neutral and contains no hostnames or credentials.

## What to publish

- `landing/index.html` and the other top-level pages.
- Subfolders such as `landing/m15-contracts/` and `landing/m14-quiz/`, which
  must keep their paths so relative links still work.
- `landing/brand/` for shared assets.

Publish the folder tree as-is. Do not rename files.

## Options

1. **Object storage with a static-website mode** (any S3-compatible service, or a
   cloud bucket). Upload the folder, set the index document to `index.html`, and put a
   CDN in front if you need HTTPS on a custom domain.
2. **Git-backed static hosting** (for example GitHub Pages or a similar service). Point
   it at a `gh-pages` branch or a `docs/` folder that you copy `landing/` into in CI.
   Do not commit the copy to `main` by hand.
3. **A plain web server** on a machine you control. Serve `landing/` as the document
   root behind TLS. Keep the server's own access logs out of the repository.

## Checklist before publishing

- Run the public-routes Playwright suite (ADR 0019) against the local build if the pages
  depend on app routes. The static pages do not.
- Check the pages contain no client names, IP addresses, or internal hostnames. The
  leak scan (`pnpm leak-scan`) covers the repository, not the hosted copy.
- Confirm the page renders at 360 px width with no horizontal scroll (PRD §16).

## Keeping the MiniMax-only script

`scripts/deploy-contracts-map.sh` publishes `landing/m15-contracts/` through the
MiniMax deploy tool. It only works in that environment. Use one of the options above
everywhere else.
