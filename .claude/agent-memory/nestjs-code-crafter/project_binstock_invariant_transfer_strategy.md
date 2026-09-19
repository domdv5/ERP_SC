---
name: project-binstock-invariant-transfer-strategy
description: How BinStock is kept in sync with Inventory for transfer (T) documents, and the void() reversal path — relevant any time TransferEffectStrategy or documents.service.ts void() is touched
metadata:
  type: project
---

As of 2026-07-21, `TransferEffectStrategy` (`backend/src/documents/strategies/transfer-effect.strategy.ts`) mirrors bin-level handling symmetrically for both legs of a traslado:

- **Destination leg** (existing before this date): `destBinId` on `Document`, validated in `validateCreate`/`confirm` (bin must belong to `destWarehouseId`), passed as `binId` to `moveStock` on the entrada call. This upserts `BinStock` via `applyBinStockChange` (in `stock.helpers.ts`).
- **Origin leg** (added 2026-07-21): `Document.sourceBinId` — same validation shape (bin must belong to `warehouseId`), passed as `binId` on the salida `moveStock` call so the source bulto's `BinStock` actually decrements when its contents are moved out. Before this change the origin leg never passed `binId` at all, so `BinStock` only ever grew and a bulto marked "occupied" (`Warehouse` findOne's derived `occupied` field) could never become vacated by moving its stock onward — a real bug, not just a documented gap.
- New helper `assertSufficientBinStock(tx, item, binId, quantity)` in `stock.helpers.ts` validates bin-level stock before the salida leg, mirroring `assertSufficientStock` (bodega-level). Only invoked when `sourceBinId` is present (bodega tipo `store` never requires it).
- `BinStock`'s composite PK in `schema.prisma` is `@@id([productId, binId])` (not `@@unique`) but Prisma still exposes it as `where: { productId_binId: { productId, binId } }` — same naming convention as an explicit `@@unique`.

**void() reversal gap fixed same day:** `DocumentsService.void()` only reversed `Inventory` via `applyStockChange`, never `BinStock`, even when the original `InventoryMovement.binId` was set — so voiding a transfer that went to/from a bulto left `BinStock` stale (bulto stuck "occupied" forever, or under-decremented). Fix: inside the reversal loop, when `movement.binId` is present, also call `applyBinStockChange(tx, { productId, binId: movement.binId, warehouseId, delta: -quantity })` — same inverted-sign pattern already used for `applyStockChange`.

**Why this matters:** `BinStock`/`Inventory` invariant (`SUM(BinStock.quantity WHERE warehouseId=W) === Inventory.quantity WHERE warehouseId=W`) is a CLAUDE.md Safety Rule — any future stock-mutation code path (new document type, new reversal path, manual adjustment endpoint) must be checked against this same pattern: does it call `applyBinStockChange` everywhere it calls `applyStockChange` with a non-null `binId`? The two are NOT auto-synced by the DB — it's purely convention across call sites.

**How to apply:** when adding a new document type strategy or a new stock-mutation path, grep for every `moveStock`/`applyStockChange` call site and verify a parallel `applyBinStockChange` call exists whenever `binId` can be non-null for that leg — both on the forward (confirm) and reverse (void) paths.

See also [[project-documents-create-manual-field-destructuring-gap]].
