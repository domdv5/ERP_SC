---
name: project-warehouses-module
description: Zones/Bins CRUD status in the Warehouses module — data model, dead-code decisions, and scope limits
metadata:
  type: project
---

Warehouses module (`frontend/src/pages/warehouses/`) — Zone/Bin management completed 2026-07-06.

**Data model correction**: `Bin` has no `name` field. Backend model is `Bin.code: Int` (positive integer, unique per zone via `@@unique([zoneId, code])`). Display as `Bolsa ${bin.code}`, never a free-text name. `frontend/src/types/warehouse.types.ts` and `frontend/src/services/warehouses.service.ts` are the source of truth for the corrected shape — `CreateBinPayload = { code: number }`, `UpdateBinPayload = { code?: number; active?: boolean }`.

**No DELETE for Zone/Bin** (deliberate, confirmed with user): backend only has POST/PATCH for `/warehouses/:id/zones` and `/warehouses/:id/zones/:zoneId/bins`. The shared `KebabMenu` component (`frontend/src/pages/warehouses/components/KebabMenu.tsx`) supports a `deleteDisabled` prop for exactly this case — greys out "Eliminar" without wiring a mutation. Warehouse-level delete IS real (has a backend endpoint) and uses the same KebabMenu without `deleteDisabled`.

**Selection/navigation pattern**: `WarehousesPage.tsx` derives a `Selection` (`{ kind: 'warehouse'|'zone'|'bin', warehouseId, zoneId?, binId? }`, defined in `warehouse-tree.types.ts`) from three query params (`?id=&zone=&bin=`), fetches `getWarehouse(id)` (returns `WarehouseDetail` with nested `zones[].bins[]`) via TanStack Query keyed `['warehouses', warehouseId]`, and passes it down to the presentational `DetailPanel`. Drill-down navigation (warehouse → zone → bin and back via breadcrumbs) goes through a single `onSelect(next: Selection | null)` callback that does `setSearchParams` with a function updater — `DetailPanel` itself has no router coupling.

**Dead code found & removed**: `WarehousesPage.tsx` used to define `WarehouseTreeItem`/`ZoneTreeItem`/`BinTreeItem` (a full sidebar-style expand/collapse tree) that was never rendered in the JSX — the page only ever rendered `<DetailPanel>`. Decision made: delete the dead tree entirely rather than wire it up, since `DetailPanel`'s card-based drill-down (using the URL-param `Selection` above) already covers the same navigation job and the actual warehouse-picker tree lives in the sidebar (`Sidebar.tsx`'s `WarehousesSidebarItem`). See [[feedback_dead_code_pages]].

**`WarehouseDetailPage.tsx` is orphaned dead code** — routed at `/warehouses/:id` but nothing in the app links to it (the sidebar and `WarehousesPage` both use the `?id=` query-param pattern on `/warehouses`, never the path param). User explicitly said not to touch/wire/delete it during the Zone/Bin task. It already had a pre-existing `tsc` error (`'id' is declared but never read`, confirmed present on `main` via `git stash` before this session) unrelated to any of this work — `pnpm build` was broken by this file before this session started. Only a mechanical, behavior-preserving edit was made to it (renamed its placeholder `bin.name` fields to `bin.code` so it type-checks against the corrected `Bin` interface) — its dead modal-state stubs and the unused `id` var were left as-is per instruction. Flag to the user next time this file comes up: it's a real candidate for deletion.
