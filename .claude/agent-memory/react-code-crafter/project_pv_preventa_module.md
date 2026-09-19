---
name: pv-preventa-module
description: Documents module PV (preventa) type — reserved-stock sale draft; release + convert-to-sale (POS/COT) both live, plus a backend-computed conversion-status chip
metadata:
  type: project
---

`Document.type` includes `PV` (preventa) alongside CM/DVC/EAI/SAJ/T/POS/COT (see [[project_documents_module]], [[project_sales_cycle_pos_cot_dvv_rem]]). PV items carry `releasedQuantity`; the doc has an optional `seller` relation. `DocumentDetailPage.tsx` derives PV behavior via `isPV`: extra "Liberado"/"Pendiente" item columns, cost column shows `item.unitPrice` (PV never persists cost), header meta grid shows "Vendedora" when `doc.seller` present.

Header action buttons (gated `isConfirmed && doc.type === 'PV'`):
- **"Liberar Stock"** (`Unlock`) — `document.release.PV`, opens `ReleaseItemsDialog`. Functional. Gating untouched by later changes.
- **"Convertir a venta"** (`ShoppingCart`) — `document.convert.PV`, now REAL (POS/COT implemented). Navigates to `/documents/pos/new?fromPV=<id>` (the shared checkout, POSCheckoutPage). Disabled when `!hasPendingItems(doc)`.

## Backend-computed `pv` conversion block (added 2026-09-01)

Every document response carries `pv: PvStatus | null` (null unless `type === 'PV'`). Shape: `{ conversion: { status: 'none'|'pending'|'converted', documents: PvDerivedDocRef[] } }` where `PvDerivedDocRef = { id, type, number: string (zero-padded), status }`. `documents` lists ALL derived POS/COT incl. `voided`; the front filters. `converted` = >=1 derived `confirmed`; `pending` = >=1 non-voided, none confirmed; `none` = none or all voided. Types in `frontend/src/types/document.types.ts` (`PvConversionStatus`, `PvDerivedDocRef`, `PvStatus`); field lives on `DocumentListItem` (inherited by `Document`). `documents.service.ts` untouched — field rides existing responses.

Frontend rendering (both `DocumentsPage.tsx` list cell "Estado" and `DocumentDetailPage.tsx` title pills):
- Chip `PV_CONVERSION_BADGE` in `document.constants.ts`: `pending` -> "En conversión" (amber), `converted` -> "Convertida" (violet). Inline `<span>` same as existing pills, NOT a shared `Badge` component. Shown only when `status !== 'none'`. GUARD: `doc.pv?.conversion.status !== 'none'` is truthy when `doc.pv` is null — always narrow via `doc.pv && ...` or a derived `pvConversion` const first.
- Age counter: `daysSince(iso)` + `formatDaysSince(n)` in `frontend/src/lib/utils.ts` ('hoy' | 'hace 1 día' | 'hace N días'), computed front-side from `doc.createdAt`. Shown only while PV open: `status === 'confirmed' && pv?.conversion.status === 'none'`. List: muted text under the chip. Detail: "Antigüedad" tile in meta grid (after Fecha), gated `isPV && isConfirmed && pvConversion?.status === 'none'`.
- Detail button gating: `const d = doc.pv.conversion.documents.find(x => x.status !== 'voided')`. When `d` exists: hide "Anular" AND "Convertir a venta", show secondary "Ver venta <type>-<number>" navigating to `d.id`. All-voided derivatives -> `d` undefined -> normal gating returns. "Liberar Stock" gating never touched. Backend also returns 409 on void/re-convert of a PV with an active derivative (this UI is prevention only).

Permissions `document.release.PV` / `document.convert.PV` seeded for `admin` + `basket_management`.
