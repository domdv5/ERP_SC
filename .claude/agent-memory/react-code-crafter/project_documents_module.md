---
name: project-documents-module
description: Documents module — implemented routes, types, service, pages, and per-type extension pattern (now includes PV/preventa)
metadata:
  type: project
---

**Documents module fully implemented** as of 2026-06-12; extended with `PV` (preventa/reserva lógica) on 2026-07-28.

Types: `DocumentType = 'CM' | 'DVC' | 'EAI' | 'SAJ' | 'T' | 'PV'`; `DocumentStatus = 'draft' | 'confirmed' | 'voided'`

Routes wired in router:
- `/documents` → `DocumentsPage` (list + filter by type/status + pagination)
- `/documents/new` → `DocumentFormPage`
- `/documents/:id` → `DocumentDetailPage`
- `/documents/:id/edit` → `DocumentFormPage` (edit mode)

Files created:
- `src/types/document.types.ts`
- `src/services/documents.service.ts`
- `src/pages/documents/DocumentsPage.tsx`
- `src/pages/documents/DocumentFormPage.tsx`
- `src/pages/documents/DocumentDetailPage.tsx`

**Why:** Backend API was built in parallel; Phase 1 covers 5 types, `PV` (preventa) added as a 6th once its backend endpoints landed.

**How to apply:** When extending documents (e.g. future types like `POS`, `REM`), add to `DocumentType` union and to `src/pages/documents/document.constants.ts` (`DOC_TYPE_SELECT_OPTIONS`, `DOC_TYPE_BADGE`) — these were extracted 2026-07-28 from what used to be 3 duplicated local label maps (`DocumentsPage.tsx`, `DocumentDetailPage.tsx`, `DocumentFormPage.tsx`). `DOC_TYPE_SELECT_OPTIONS` (full labels, e.g. "Devolución compra") and `DOC_TYPE_BADGE` (short labels + className, e.g. "Dev. Compra") are deliberately separate maps, not merged — the existing labels genuinely differ between the form dropdown and list/detail pills.

**Conditional per-type item columns (established pattern, reused 2026-07-14 for `observaciones`, reused again 2026-07-28 for `PV`'s price column + Liberado/Pendiente):** a boolean derived from `docType` (e.g. `showObservaciones`, `showPrice`) gates an entire `<td>` in `ProductRow.tsx` and the matching `<th>` in `DocumentFormPage.tsx`'s `<thead>`, plus a mirrored column in `DocumentDetailPage.tsx` (built via a conditional `itemHeaders` array + `footerSkipCols` to keep the `<tfoot>` Total cell aligned). Every place that constructs a full item object literal must get the new field too, or the row shape drifts: `append()` default in `DocumentFormPage.tsx`, `BarcodeScanInput.tsx`'s `append()`, the `onSubmit` payload mapper, and the edit-mode `reset()` items mapper that loads `existingDoc.documentItems`. Follow this same recipe for any future per-type item field.

**PV (preventa/reserva lógica) specifics, 2026-07-28:** `sellerId` (vendedora) is a document-level field distinct from `thirdPartyId` (cliente) — both use the shared `Combobox`, `thirdPartyId` filtered `isCustomer: true` instead of `isSupplier: true`, `sellerId` filtered via a new `isSeller` param on `GetThirdPartiesParams`/`/third-parties`. `DocumentItem` gained `releasedQuantity?`/`convertedQuantity?` (from `POST /documents/:id/release-items`) and reuses existing `unitPrice` (was already on the type, previously unused by any strategy). New `ReleaseItemsDialog.tsx` component (in `components/`) named its prop `doc` not `document` — deliberately avoids shadowing the global DOM `document`, matching `DocumentDetailPage.tsx`'s existing `doc` variable convention. `ProductRow.tsx`/`BarcodeScanInput.tsx` extended their existing "capture at point of external row-creation, thread through as `initial*` prop" pattern (see below) to add `initialSalePrice`/`salePrice` alongside `initialAvgCost`/`initialUnitOfMeasure`.

**Known backend gap found during PV verification (2026-07-28, not a frontend bug):** `documents.service.ts`'s detail query (`GET /documents/:id`) never included a `seller` relation — only raw `sellerId` — so `Document.seller` is always `undefined` at runtime today despite being typed `DocumentThirdParty | null`. Frontend code guards with `doc.seller &&` so it degrades gracefully (no crash, just hides the "Vendedora" block); will start working automatically once backend adds `seller: { select: { id, name } }` to that include, no frontend change needed then.

**`DOC_TYPE_ACCENT` (2026-07-28) — per-type icon + left-border accent, sibling to `DOC_TYPE_BADGE`:** added `export const DOC_TYPE_ACCENT: Record<DocumentType, { icon: LucideIcon, iconBg, iconText, border }>` in `document.constants.ts`, deliberately reusing the exact same `bg-*-100 dark:bg-*-500/20` / `text-*-700 dark:text-*-400` color-per-type as `DOC_TYPE_BADGE` (just split into pieces for an icon chip instead of a pill), plus a `border-l-{color}-500` class. Icons: CM=ShoppingCart, DVC=Undo2, EAI=PackagePlus, SAJ=PackageMinus, T=ArrowLeftRight, PV=CalendarClock. Consumed in `DocumentDetailPage.tsx` (header card: `border-l-4` + `accentInfo.border` on the outer card, icon chip replaces the generic `gradient-dark`+`FileText`) and `DocumentFormPage.tsx` (icon chip next to the page `<h1>`, plus `border-l-4` on the "Información general" card — `accent` is derived live from `watch('type')` so it updates as the user changes the type dropdown). This was an explicit design decision (user-approved) to echo a legacy ERP's "color stripe per operation type" affordance without violating `interface-design/system.md`'s "borders only, no saturated full-width stripes" rule — a thin left border instead of a full band. If a 7th `DocumentType` is ever added, extend `DOC_TYPE_BADGE` AND `DOC_TYPE_ACCENT` together (same color) to keep the pill/icon/border mapping consistent — don't add one without the other.
