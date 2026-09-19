---
name: project_audit_scripts_pattern
description: Backend has a family of standalone read-only Prisma audit scripts under backend/scripts/, exposed as pnpm scripts, used to check invariants without an API request.
metadata:
  type: project
---

`backend/scripts/*.mjs` holds standalone, read-only audit scripts that connect directly via `@prisma/client` + `@prisma/adapter-pg` (using `process.env.DATABASE_URL` from `dotenv/config`), print human-readable violation lines, and `process.exit(1)` on any violation found (0 if clean). Each is registered in `package.json`'s `"scripts"` as `"audit:<name>": "node scripts/<file>.mjs"`. They are NOT run as part of `build`/`lint`/`test`/CI — purely manual/on-demand checks.

Existing scripts:
- `audit-binstock-invariant.mjs` / `pnpm audit:binstock` — verifies `SUM(BinStock.quantity WHERE warehouseId=W) === Inventory.quantity WHERE warehouseId=W` per warehouse (the BinStock/Inventory Safety Rule in CLAUDE.md).
- `audit-bin-multi-product.mjs` / `pnpm audit:bin-products` — verifies no single `Bin` holds `BinStock` rows (`quantity > 0`) for more than one distinct `productId` (added 2026-08-10 alongside the transfer-strategy single-product-per-bin business rule).

**Why this matters**: when asked to add a new invariant-check or audit task, follow this exact pattern (same imports, same exit-code convention, same package.json wiring) rather than inventing a new script shape — read the most similar existing script first.

**How to apply**: any future "add an audit script for X" request in this backend should mirror `audit-binstock-invariant.mjs`'s structure line-for-line (adapter setup, loop + violation counter, final OK/count message, exit code).
