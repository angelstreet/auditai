# 0042 - Server-side PDF of the audit report with pdfkit

- Status: Accepted
- Date: 2026-10-19
- Related: [0025](0025-design-tokens.md), [0027](0027-one-font-and-playwright-in-ci.md), [0041](0041-audit-report-improvement-catalogue-readiness.md), TASK-V

## Context

The client needs the audit report as a document they can forward to a sponsor and read on paper (PRD §28.1,
AUDIT_WORKFLOW readiness item 9). It must say exactly what the published report says, carry the brand (tokens,
the one font), work in French and English, have page numbers, and run on Vercel functions and on a memory-tight
shared host without a headless browser.

## Decision

- **pdfkit 0.20** draws the published snapshot (`ReportSnapshot`, ADR 0041) in `apps/web/src/lib/reportPdf.ts`:
  title block, summary with its sources, readiness score with axes and plain-word levels, key findings, the
  impact and effort matrix and the ranked opportunities with their steps, the 30/60/90-day plan, risks and
  prerequisites, method and privacy note. A4, 56 pt margins, page numbers and the report title in the footer of
  every page. Colours come from the light palette tokens (`@evolai/ui/palette`), text from the i18n catalogue in
  the reader's language; the content stays in the language it was written in.
- **One font.** Inter 400 and 600 from the design system. fontkit cannot subset the WOFF2 files for a PDF, so
  `packages/ui/pdf-fonts/` holds TrueType copies of the same OFL subset (converted once; README there). The
  standard PDF fonts are never loaded.
- **Only the published snapshot is printed.** `GET /client/report/pdf` takes the engagement from the session's
  teams; `GET /admin/reports/[engagementId]/pdf` is staff only. Both return 404 when nothing is published, send
  `Cache-Control: private, no-store`, and write a `report.export` row to the audit trail (no content).
- **Deploy.** `pdfkit` is a server external package (it reads its own files at run time) and the two font files
  are added to the routes' output trace (`outputFileTracingIncludes`, tracing root at the repository root).

## Alternatives considered

- **Headless Chrome (Playwright or Puppeteer) printing the page.** Best fidelity with the screen, but a 100+ MB
  browser in a serverless function and hundreds of MB of memory per render on a host that kills big processes.
- **@react-pdf/renderer.** Reuses JSX, but pulls a layout engine (yoga, WebAssembly) and a larger bundle; the
  report is a linear document that pdfkit lays out in a few hundred lines.
- **pdf-lib.** Small, but no text layout (wrapping, page breaks) built in.
- **Browser print only.** Kept as a secondary action (print stylesheet on the client page), but it gives no file
  to forward and depends on the reader's browser settings.

## Consequences

- One document in memory per request (tens of KB); rendering takes milliseconds.
- The PDF layout is separate code from the screen layout; both read the same snapshot and the same catalogue
  keys, and a unit test checks size, font, page count and footer behaviour.
- If the screen fonts change, regenerate the TrueType copies.
