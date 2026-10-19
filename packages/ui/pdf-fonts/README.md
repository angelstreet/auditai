# Fonts for server-side PDFs

TrueType copies of `src/fonts/inter-latin-400.woff2` and `inter-latin-600.woff2` (same Inter subset, SIL Open
Font License, see `OFL.txt`), converted once with fontTools. The PDF library (pdfkit through fontkit) cannot
subset these WOFF2 files, so the audit report PDF (ADR 0042) embeds these instead. Screens keep using the WOFF2
files. Regenerate only if the screen fonts change.
