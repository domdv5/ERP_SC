---
name: by-code-locations-endpoint
description: GET /products/by-code/:code/locations added 2026-08-03 — parallel to existing GET /inventory/:productId/location, different lookup key and response shape
metadata:
  type: project
---

`ProductsController.findLocationsByCode` / `ProductsService.findLocationsByCode` (added
2026-08-03) exposes `GET /products/by-code/:code/locations` — looks up a product by `code`
(case-insensitive), then fetches `BinStock` rows (with `.bin.zone` and `.warehouse` included,
`quantity > 0` only) plus all `Inventory` rows for that product in one `$transaction`. Registered
in the controller between `by-code/:code` and `:id` (route-order matters here the same way it
does for `GET /auth/roles` vs `GET /auth/:id` — see [[project_pv_reservation_self_count_and_action_permissions]]
pattern of route ordering, though this one is segment-distinct so Nest doesn't actually ambiguity-match).

This is a **near-duplicate in intent** of the pre-existing `GET /inventory/:productId/location`
described in [[project_inventory_module_and_rbac_seed_gotcha]] — that one takes a `productId` and
returns a per-warehouse `unassignedQuantity` view; this new one takes a product `code`, returns a
flat per-bin `locations[]` array plus `warehouseTotals[]` and a `hasUnassignedStock` boolean,
scoped under `ProductsModule` instead of `InventoryModule`. Both derive from the same
`BinStock`-only-populated-by-transfers rule (business rule documented in root `CLAUDE.md` under
DocumentsModule). If asked to touch either endpoint in the future, check whether the other should
change too — they encode the same "stock without an assigned bin is normal, not a bug" logic
independently, and could drift.

The response-shaping logic after the `$transaction` fetch was left as an intentional
`TODO(human)` checkpoint (learning-mode methodology, task explicitly forbade completing it) — see
[[feedback_todo_human_checkpoint_no_compile_error]] for what verifying that leaves you with.
