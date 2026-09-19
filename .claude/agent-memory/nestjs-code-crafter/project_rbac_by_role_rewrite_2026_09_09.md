---
name: rbac-by-role-rewrite-2026-09-09
description: 2026-09-09 RBAC rewrite — basket_management renamed to preventa, new inventory.manage perm, GET /documents silently scoped by document.create.{TYPE} perms
metadata:
  type: project
---

Andrés reworked RBAC per-role on 2026-09-09 (backend only; frontend handoff pending). Non-obvious
pieces worth keeping:

**Role rename `basket_management` → `preventa`.** `seedRoles` uses
`prisma.role.createMany({ skipDuplicates: true })`, which cannot rename an existing row. Fix
pattern: an explicit `prisma.role.updateMany({ where: { name: 'basket_management' }, data: { name:
'preventa', ... } })` runs *before* the `createMany`, so existing `UserRole` rows (which reference
the role by id) survive. The `createMany` array entry was also changed to `preventa` so a fresh DB
seeds correctly. **Any future role rename must use this same updateMany-before-createMany pattern.**

**Why:** in-place rename keeps already-issued JWTs' user→role assignments intact; a
delete+recreate would orphan every `UserRole`.

**`GET /documents` is now silently scoped by document type.** `@Permissions('document.read')` is
still the coarse gate. On top of it, `DocumentsService.findAll(dto, user: JwtPayload)` intersects
the requested types with `visibleDocumentTypes(user.permissions)` — a private helper that derives
allowed `DocumentType[]` from the user's `document.create.{TYPE}` permission strings (there is no
`document.read.{TYPE}`). Requesting `?type=`/`?types=` outside the role's scope returns an **empty
list, never 403**. `where.type` is now always `{ in: effectiveTypes }` (replaced the old
conditional spread). `admin` holds all 12 `document.create.*` so it sees everything. Helper
signature: `private visibleDocumentTypes(permissions: string[]): DocumentType[]` in
`backend/src/documents/documents.service.ts`, just above `findAll`.

**New permission `inventory.manage`** (module `warehouses`, registered in `permissions.seed.ts`
near `warehouse.manage`). Gates `GET /products/by-code/:code/locations` (physical stock-location
lookup, frontend `StockLookupPage`). `GET /products/by-code/:code` (no `/locations`) stays on
`product.read` — barcode scan for POS checkout + document detail. Granted to `admin`,
`purchasing`, `warehouse`, `preventa`.

**`GET /warehouses` and `GET /warehouses/:id` now require `warehouse.manage`** (were JWT-only).

**Final role→permission matrix** lives in `role-permissions.seed.ts` — that file is authoritative,
don't rely on a copy here. Shape after this task: `preventa` is a tight role (product/thirdparty
read + full PV cycle create/release/convert + inventory.manage, no POS/REM/warehouse.manage);
`billing` owns the direct-sale cycle (POS/COT/REM create + convert.REM, no release.REM — convert
and release are separate authorities by design); `purchasing` lost `product.delete`,
`thirdparty.delete`, `document.create.REM` and gained `document.create.DVC` + `inventory.manage`;
`accounts_admin`/`accounts_assistant` gained `product.create/update` + `document.create.CM/DVC`,
still identical to each other except `accounts_admin` has `user.manage` + `system.manage`.

**How to apply:** RBAC seed edits here were pre-authorized by Andrés ("procedé con todo") — this
is the [[feedback_consult_architects_before_schema_unification]]-adjacent Safety Rule area, but a
spec-with-final-arrays handoff from the orchestrator counts as sign-off. Still check both seed
files together (the [[project_inventory_module_and_rbac_seed_gotcha]] silent-no-op trap).
