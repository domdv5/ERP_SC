---
name: preventa-derived-reservation
description: PV (Preventa) reservations are always derived from confirmed PV DocumentItems — never a persisted aggregate — to avoid a second stock invariant
metadata:
  type: project
---

Preventa (`DocumentType.PV`, added 2026-07-28) reserves inventory **logically**, never physically. The reserved quantity per product is always computed on the fly from confirmed `PV` `DocumentItem` rows as `quantity - releasedQuantity - convertedQuantity`. There is deliberately **no** persisted aggregate column (no `Product.reserved`, no `Inventory.reserved`).

`ReservationRelease` is an append-only audit log of partial releases (who/when/how much); `DocumentItem.releasedQuantity` is the running accumulator of those rows. Never expose update/delete on it.

**Why:** a persisted reservation total would create a *second* invariant to keep in sync alongside the project's already Safety-Rule-protected `SUM(BinStock.quantity WHERE warehouseId=W) === Inventory.quantity WHERE warehouseId=W`. Deriving it means it can never drift. This mirrors the same reasoning behind `Bin.occupied` being derived live from `BinStock` rather than a mutable column.

**How to apply:** if asked to "optimize" preventa reads by caching a reserved total on `Product`/`Inventory`, push back — the derived query is the design, not an oversight. Index support already exists: `Document(type, status)` and `DocumentItem(productId)`. If that aggregate query ever gets slow at scale, prefer a materialized view or a covering index over a denormalized column. PV touches neither `Inventory` nor `BinStock`.

Related: [[credit-tables-stay-separate]] (same YAGNI-over-premature-generalization instinct on this schema).
