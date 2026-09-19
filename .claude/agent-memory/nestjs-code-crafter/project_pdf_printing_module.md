---
name: project-pdf-printing-module
description: PDF printing (CM/DVC) implemented in documents/print/ — pdfmake 0.3.x API gotchas that will bite any future document type added to this feature
metadata:
  type: project
---

Implemented 2026-08-21: `GET /documents/:id/print` generates a PDF for confirmed `CM`/`DVC` documents, via `backend/src/documents/print/` (Strategy pattern parallel to `DocumentEffectsRegistry`, see [[project_binstock_invariant_transfer_strategy]] for the sibling pattern). `DocumentPrintRegistry` maps `DocumentType` → `DocumentPrintStrategy`; adding a phase-2 printable type (`COT`/`POS`/etc.) is a new strategy class + registry entry, no other file touched.

**pnpm installed pdfmake@0.3.11 (latest), NOT the older 0.1/0.2 API most tutorials/plans assume.** This matters for any future work in `documents/print/`:

1. **No `PdfPrinter` class export.** The old `new PdfPrinter(fonts).createPdfKitDocument(def)` streaming pattern doesn't exist at the package root anymore (it's `Printer.js` internally but not exported). Use the singleton module API instead: `import pdfMake from 'pdfmake'` then `pdfMake.setFonts(...)`, `pdfMake.createPdf(definition).getBuffer()` → already returns `Promise<Buffer>`, no manual stream/chunk handling needed.

2. **Must use default import, never `import * as pdfMake from 'pdfmake'`.** A namespace import gets wrapped by esbuild/tsx (and likely other bundlers) into an object where every property is a getter-only accessor for CJS interop. Calling `pdfMake.setFonts(...)` on that wrapper throws `TypeError: Cannot set property fonts of #<pdfmake> which has only a getter`, because `this` inside the method resolves to the wrapper, not the real singleton. `import pdfMake from 'pdfmake'` (default import, relying on `esModuleInterop`) gives the real object and avoids this entirely.

3. **`setLocalAccessPolicy`/`setUrlAccessPolicy` gate font file loading too**, not just images referenced in the document content. A blanket `() => false` on local access breaks font loading with `Access to local file denied by resource access policy`. Scope it to the exact fonts directory: `(filePath) => filePath.startsWith(FONTS_DIR)`.

4. **Real Roboto `.ttf` files ship inside the installed package** at `node_modules/pdfmake/build/fonts/Roboto/*.ttf` (Regular/Medium/Italic/MediumItalic) — no need to decode `vfs_fonts.js` base64 or download from Google Fonts. Copied literally into `backend/src/documents/print/fonts/`.

5. **`nest-cli.json` needed a new `compilerOptions.assets` entry** to copy those `.ttf` files into `dist/` on build (tsc alone only copies `.ts`→`.js`). Because this project's tsc `rootDir` is inferred as the repo's `backend/` root (both `src/**` and `prisma/*.ts` get compiled, landing at `dist/src/**` and `dist/prisma/**`), the assets `outDir` had to be `"dist/src"` — not `"dist"` — for the copied fonts to land next to the compiled `pdf-fonts.config.js` that reads them via `path.join(__dirname, 'fonts', ...)`. If that implicit rootDir inference ever changes (e.g. prisma stops being compiled alongside src), this asset path breaks silently — check `dist/documents/print/fonts` vs `dist/src/documents/print/fonts` if a "font not found" error shows up in prod.

6. **Date formatting needs explicit `timeZone`.** `document.date` is stored as UTC-midnight representing a pure calendar date (`new Date(dateOnlyString)` in `documents.service.ts::create()`) — must format with `timeZone: 'UTC'` or it shifts a day backward on any server with a negative UTC offset. `document.createdAt` is a real timestamp and correctly uses `timeZone: 'America/Bogota'` instead. Mixing these up is an easy silent bug — verified via a scratch smoke-test PDF before catching it.

**How to smoke-test this module without full Nest bootstrap or DB**: build a fake `DocumentForPrint`-shaped object inline, call `buildPurchaseDocumentDefinition(fake, {title})` + `new PdfGeneratorService().generate(...)`, run via `npx tsx <scratch-file>.ts` from `backend/` (tsx auto-resolves the `@/` tsconfig path alias), write the buffer to a `.pdf`, then `Read` it (renders visually + extracts text). Caught both the pdfmake API mismatches and the timezone bug this way, before ever touching a real DB record. Delete the scratch file and generated PDFs when done — don't leave them in the repo.
