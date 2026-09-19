---
name: project-pv-reservation-self-count-and-action-permissions
description: PV (preventa) reservation system — self-counting bug when a confirm()-time derived aggregate includes the document being confirmed, and the assertDocumentPermission generalization to support non-"create" actions
metadata:
  type: project
---

Implemented 2026-07-28: `DocumentType.PV` (preventa) — a document type whose `confirm()` never touches `Inventory`/`BinStock`/`InventoryMovement`. The reservation is purely derived: `getReservedByProduct` (`backend/src/documents/helpers/reservation.helpers.ts`) sums `DocumentItem.quantity - releasedQuantity - convertedQuantity` across all confirmed PV documents for a product.

**Self-counting gotcha in confirm()-time derived aggregates:** `DocumentsService.confirm()` flips `Document.status` to `confirmed` via `tx.document.updateMany(...)` **before** calling `strategy.confirm(tx, document, userId)`, all inside the same transaction. So if a strategy's `confirm()` runs a query that aggregates "all confirmed documents of this type" to validate the document being confirmed, that query will see the document's own row as already-confirmed and double-count its own items against itself. `PvEffectStrategy.confirm()` avoids this by passing `{ excludeDocumentId: document.id }` to `getReservedByProduct`. **How to apply:** any future strategy that runs a self-referential aggregate query inside `confirm()` (not just PV) must exclude the document's own id from that query — the bug is silent (no error, just a wrong number) and only shows up as an off-by-N validation failure on the item's own quantity.

**`assertDocumentPermission` generalized from single-purpose to action-parameterized:** it used to hardcode `document.create.{type}` and was reused as-is (not just semantically, literally that permission string) by `create()`/`update()`/`confirm()`/`void()`/`remove()` — i.e. the whole lifecycle sits behind one permission per type. Added a third param `action: 'create' | 'release' = 'create'` (default preserves all 5 existing call sites unchanged) so the new `releaseItems()` method can check `document.release.{type}` instead. **How to apply:** the seeded permissions already include `document.convert.PV` for a not-yet-implemented "convert reservation to real sale" endpoint — when that's built, extend the `action` union type (`'create' | 'release' | 'convert'`) rather than adding a second permission-checking method.

**Cross-module helper import precedent:** `products.service.ts` imports `getReservedByProduct` from `@/documents/helpers/reservation.helpers` directly — confirmed safe with the user's own architecture (helpers are plain functions taking `PrismaService | Prisma.TransactionClient` as a param, not Nest providers, so no module import/export wiring or circular-dependency risk). Same precedent applies to `stock.helpers.ts` if ever needed outside `documents/`.

See also [[project-documents-create-manual-field-destructuring-gap]] (same `create()` destructuring-list gotcha applied again here for `sellerId`) and [[project-binstock-invariant-transfer-strategy]].
