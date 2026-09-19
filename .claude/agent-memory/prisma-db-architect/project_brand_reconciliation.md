---
name: brand-reconciliation-decision
description: Supplier brands use diff-reconciliation (hard delete unreferenced, soft-delete via existing `active` field) instead of deleteMany+createMany; @@unique([supplierId, name]) on Brand is a pending migration
metadata:
  type: project
---

Supplier brand updates in `third-parties.service.ts` must use diff-reconciliation, never `deleteMany: {} + createMany`.

**Why:** `Product.brandId` FK caused P2003 when delete-all/recreate ran; recreating also regenerated brand UUIDs and lost identity. `Brand` already has `active Boolean @default(true)` + `@@index([active])`, so soft-delete needs no migration. Decision (2026-06-11): removed brands with products → `active: false`; removed brands without products → hard delete; matching names → keep/reactivate; new names → create. Comparison is case-insensitive + trimmed because `Brand` lacks `@@unique([supplierId, name])`.

**How to apply:** When touching brand logic, preserve this reconciliation pattern. Pending migration candidate: `@@unique([supplierId, name])` on `brand` (requires duplicate cleanup first). Any `include: { brands: true }` should filter `where: { active: true }`.
