---
name: project-pos-pv-conversion-feature
description: POS (venta de contado) + PV→POS conversion implemented 2026-08-24 — shortfalls ConflictException shape, extension points now consumed
metadata:
  type: project
---

Implemented on 2026-08-24: `POS` document type (`PosEffectStrategy`) and `POST /documents/:id/convert` (PV→POS conversion). This consumed the extension points [[project_binstock_invariant_transfer_strategy]]/[[project_pv_reservation_self_count_and_action_permissions]] previously documented as unused (`Document.sourceDocumentId`, `DocumentItem.convertedQuantity`, `ReservationEffectStrategy.consumeForConversion?()`).

**Why:** first Phase 2 sales document type — first type to move physical stock while also being price-based (`unitPrice`, joins `PV` in `PRICE_BASED_TYPES`).

**How to apply:**
- New Prisma enum `PaymentMethod` (`efectivo|tarjeta|transferencia`), `Document.paymentMethod` nullable field, migration `20260824191522_add_pos_payment_method`.
- `BaseEffectStrategy` gained two new protected helpers usable by any future strategy: `assertPricesAboveFloor(items)` (accumulates ALL violations, one exception) and `assertBatchAvailability(tx, warehouseId, items, {excludeDocumentId?})` (batch FOR UPDATE stock check, returns shortfalls array instead of throwing — caller decides). `PvEffectStrategy.confirm()` was refactored to call the extracted `assertBatchAvailability` instead of its old inline batch+loop — observable behavior unchanged (still throws on first shortfall with the same message).
- `ReservationEffectStrategy` interface gained `consumeForConversion(tx, sourceDocument, conversions, userId)` — implemented by `PvEffectStrategy` using the same atomic `UPDATE...WHERE...RETURNING` pattern as `releaseItems`, writing to `convertedQuantity` (NOT `ReservationRelease` — that table is only for manual releases).
- `documents.service.ts::confirm()` — after `strategy.confirm()`, if the confirmed document has `sourceDocumentId`, resolves the source doc's strategy and (if it's a `ReservationEffectStrategy`) calls `consumeForConversion` in the same transaction, matched via new helper `matchItemsByProduct` (`documents/helpers/conversion.helpers.ts`, sums by productId, no 1:1 assumption).
- `documents.service.ts::void()` — `include` now also loads `documentItems`; new symmetric branch reverses `convertedQuantity` on the source PV's items (`GREATEST(converted_quantity - X, 0)`) when voiding a document that has `sourceDocumentId` and whose source is a reservation strategy. Without this, voiding a converted POS would permanently lock those units out of the PV's reservation.
- `assertDocumentPermission` action param widened to `'create' | 'release' | 'convert'`; new permission `document.convert.PV` (already seeded — confirmed present in `role-permissions.seed.ts`/`permissions.seed.ts` for `admin`/`basket_management`, no seed changes were needed or made).
- **POS confirm() shortfall response shape**: `ConflictException({ message: 'Stock insuficiente para uno o más productos', shortfalls })` where `shortfalls: { productId, code, available, requested }[]`. This is a structured object body (not a plain string), unlike PV's single-string ConflictException — frontend needs to branch on this shape for POS specifically.
- `find-all-documents.dto.ts` gained `thirdPartyId` filter (for future frontend use, `GET /documents?type=PV&thirdPartyId=X`).

Build verified clean (`pnpm exec nest build`, exit 0) including `PvEffectStrategy` implementing the new interface method.
