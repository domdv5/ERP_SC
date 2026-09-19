---
name: inventory-module-and-rbac-seed-gotcha
description: InventoryModule (GET /inventory/:productId/location) exists now; role-permissions.seed.ts silently no-ops permission codes not yet in permissions.seed.ts
metadata:
  type: project
---

`backend/src/inventory/` (module/controller/service) was added 2026-07-28 to expose
`GET /inventory/:productId/location` — combines `Inventory` (source of truth per warehouse) +
`BinStock` (bin-level breakdown, only populated by transfer documents per
[[project_binstock_invariant_transfer_strategy]]) into a per-warehouse view with
`unassignedQuantity = inventory.quantity - sum(binStocks for that warehouse)`. A nonzero
`unassignedQuantity` is normal/expected (e.g. a `CM` purchase straight into a `store` warehouse,
never transferred) — not an invariant violation, don't treat it as a bug to fix or log a warning
for. Guarded by permission `inventory.manage`.

**UPDATE 2026-09-09** (see [[project_rbac_by_role_rewrite_2026_09_09]]): `inventory.manage` is now
a real registered permission in `permissions.seed.ts` with module `warehouses` (not `inventory`).
Granted to `admin`, `purchasing`, `warehouse`, `preventa`. The `basket_management` role was
renamed to `preventa` in the same task.

**RBAC seed gotcha confirmed by this change**: `seedRolePermissions()` in
`role-permissions.seed.ts` does `permissionMap.get(code)` and silently skips (no error, no log)
any code not present in `permissions.seed.ts`. `role-permissions.seed.ts` had referenced
`'inventory.manage'` for the `warehouse` role for a long time before the permission actually
existed — it was a silent no-op the whole time. When adding a new permission string to a role's
array in `role-permissions.seed.ts`, always grep `permissions.seed.ts` first to confirm the code
is actually registered there, or it'll look like it worked (no seed error) while granting
nothing.

**Why:** the plan this was built from (`crispy-hugging-biscuit.md`, gitignored under
`~/.claude/plans/`) called this out explicitly and the user pre-confirmed both the new module and
the seed fix in the same task — no separate confirmation needed for RBAC seed edits when a plan
already got sign-off on the exact codes/roles.

**How to apply:** when asked to add any new permission code in future work, check both seed files
together before declaring the RBAC change done — a permission that's referenced in
`role-permissions.seed.ts` but missing from `permissions.seed.ts` will pass `pnpm seed` with zero
errors and just not grant anything.
