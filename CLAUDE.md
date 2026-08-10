# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Start

**Read this file completely at the start of every session before taking any action.**

## Safety Rules

Do NOT change without explicit instruction and confirmation first:

- **Auth flow** (`AuthModule`, `JwtAuthGuard`, `PermissionsGuard`, JWT payload shape) — every route in the app depends on the current token contract; a silent change locks out users or opens routes.
- **Prisma schema migrations** — always use the manual workaround in Commands above; never run destructive migration commands (`migrate reset`, `db push --force-reset`).
- **Global bootstrap wiring in `main.ts`** (`ValidationPipe`, `PrismaExceptionFilter`, `ResponseFormatInterceptor`, `APP_GUARD` registrations) — these are cross-cutting; breaking one breaks every endpoint's response shape or auth behavior at once.
- **RBAC seed data** (`roles`, `permissions`, `RolePermission` mappings in seed script) — changing names/keys here desyncs already-issued JWTs (permissions are baked into the token, not re-checked against DB).
- **`BinStock` / `Inventory` invariant** (`SUM(BinStock.quantity WHERE warehouseId=W) === Inventory.quantity WHERE warehouseId=W`) — any stock-mutation code must preserve this; breaking it corrupts reported stock silently.

If a change requires touching any of the above, state clearly what and why, and wait for confirmation before implementing.

## Code Documentation Conventions

Document the **why**, never the **what** — well-named identifiers already say what code does; a comment earns its place only when the reader can't derive it from the code itself.

- **Document**: non-obvious business rules/invariants, design decisions with real trade-offs, workarounds for a specific bug/limitation, concurrency/locking rationale, non-obvious algorithms or formats (e.g. zero-padding for lexicographic order), anything that would genuinely surprise a future reader.
- **Don't document**: trivial CRUD, simple getters/destructuring, self-explanatory conditionals, anything a competent reader infers instantly from names/types.
- **Style**: short inline `//` comments in **Spanish** (matches existing comments across the codebase) for business-logic explanations; JSDoc only on exported functions/classes whose behavior isn't obvious from the signature — never on trivial ones. No multi-paragraph comment blocks.
- **Before adding a comment**, check the surrounding code for one that already explains the same thing — don't duplicate.
- This is a comment-only concern — never justifies changing logic, renaming, or refactoring as a side effect of "documenting."

## Project Overview

ERP Supply Chain — full-stack application for managing products, inventory, warehouses, customers, suppliers, accounts receivable/payable, and documents.

- **Backend**: NestJS REST API (`backend/`)
- **Frontend**: React SPA named **EloSC** (`frontend/`), brand colors `#141a17` primary / `#07bc34` secondary

## Commands

All commands run from the `backend/` directory using `pnpm`. See `backend/package.json` scripts for the full list.

> **Migration workaround** — `migrate:dev` needs an interactive terminal and fails in Claude Code. Use instead:
> 1. `pnpm exec prisma migrate diff --config prisma/prisma.config.ts --from-config-datasource --to-schema prisma/schema.prisma --script` → get SQL
> 2. Create `prisma/migrations/<timestamp>_<name>/migration.sql` manually with that SQL
> 3. `pnpm exec prisma migrate deploy --config prisma/prisma.config.ts` → apply
> 4. `pnpm exec prisma generate --config prisma/prisma.config.ts` → regenerate client

## Architecture

### Module Structure

**Bootstrap** (`main.ts`):

- Global `ValidationPipe` for DTO validation
- Global `PrismaExceptionFilter` — catches Prisma errors P2002/P2003/P2025 and returns Spanish-language HTTP errors
- Global `ResponseFormatInterceptor` — wraps all responses as `{ success, data }`
- Listens on `PORT` env var (default 3000)

**AppModule** imports: `ConfigModule` (global, reads `.env`), `AuthModule`, `PrismaModule`, `ThirdPartiesModule`, `ProductsModule`, `WarehousesModule`, `DocumentsModule`, `AccountsPayableModule`, `AccountsReceivableModule`

**PrismaModule** is global — inject `PrismaService` anywhere without re-importing the module.

**AuthModule**:

- `GET /auth` — list all users with roles; requires `user.manage`
- `GET /auth/roles` — list all active roles with their permissions; requires `user.manage`
- `POST /auth` — create user (requires name, username, password, roleIds[]); requires `user.manage`
- `PATCH /auth/:id` — update user (password and roleIds optional); requires `user.manage`. When `password` is present it's bcrypt-hashed (10 salt rounds, same as create) before the `user.update` call — never written in plaintext
- `DELETE /auth/:id` — delete user (hard delete); requires `user.manage`
- `POST /auth/login` — returns JWT containing `{ sub, name, username, permissions[] }`
- `JwtAuthGuard` — validates Bearer token; attaches `{ sub, name, username, permissions[] }` to `request.user`
- JWT expiration: 8 hours
- **Route order rule**: `GET /auth/roles` must be declared before any future `GET /auth/:id` to prevent NestJS treating `"roles"` as an id param

**ThirdPartiesModule**:

- `POST /third-parties` — create a third party (customer and/or supplier); requires `thirdparty.create` permission
- `PATCH /third-parties/:id` — update; requires `thirdparty.update`
- `DELETE /third-parties/:id` — soft-delete; requires `thirdparty.delete`
- `PATCH /third-parties/:id/brands/:brandId` — rename a brand in-place; requires `thirdparty.update`
- Supports `personType`: `natural` | `juridica`
- Supports `documentType`: `CC | NIT | CE | PAS | TI | RC`
- Conditional validation: natural persons require `firstName`/`lastName`; juridical persons require `businessName`
- Optional customer fields: `creditLimit`, `discount`, `sellerId`
- Optional supplier field: `internalNumber`
- Transactional creation: ThirdParty + Customer/Supplier records in one transaction
- **Brand rules**: brands can only be added or renamed — never deleted (products reference them). `update` does `createMany` + `skipDuplicates`; frontend sends only new brands (not already in `brandIds` map). `isCustomer`/`isSupplier` are real `Boolean` columns on `ThirdParty` (`@default(false)`, indexed) set directly from the DTO in `create`/`update` — they are not derived from the presence of `customer`/`supplier` relations.

**WarehousesModule**:

- `GET /warehouses` — list all warehouses (optional `?active=true|false`); JWT required
- `GET /warehouses/:id` — detail with zones → bins hierarchy; JWT required
- `POST /warehouses` — create; requires `warehouse.manage` permission
- `PATCH /warehouses/:id` — update; requires `warehouse.manage` permission
- `DELETE /warehouses/:id` — soft-delete (`active: false`); requires `warehouse.manage` permission
- `type` is `WarehouseType` enum: `store` (almacén, sellable stock) | `warehouse` (bodega, storage only)
- Seed creates two records: `Almacén` (store) and `Bodega` (warehouse)
- Sales operations must only validate against `store`-type warehouse inventory
- Single permission `warehouse.manage` covers all write operations
- **Sub-resources (Aggregate Root pattern)**: Zone and Bin live inside WarehousesModule — no separate module. URLs: `POST /warehouses/:id/zones`, `PATCH /warehouses/:id/zones/:zoneId`, `DELETE /warehouses/:id/zones/:zoneId`, and equivalent `/bins` nested under `/zones/:zoneId/bins`. Justification: Zone/Bin have no lifecycle outside Warehouse; all endpoints require `:warehouseId` as first param.
- **Zone fields**: `name` (unique per warehouse via `@@unique([warehouseId, name])`), `active` (soft-delete)
- **Bin fields**: `code` (`Int`, numeric bin number 1..n, unique per zone via `@@unique([zoneId, code])`), `active` (soft-delete)
- **Business rules (not yet implemented)**: neither `zones.service.ts` nor `bins.service.ts` has a `remove()`/`DELETE` route today. When added, `removeZone` must verify no active bins; `removeBin` must verify `Inventory.quantity === 0`
- **findOne filter (pending — TASK 5)**: `warehouses.service.ts::findOne`'s `include` currently returns zones/bins unfiltered (no `where: { active: true }`); it must be changed to return only `active: true` zones and bins

**DocumentsModule**:

- `GET /documents` — list with filters (type, status, dateFrom, dateTo, search); requires `document.read`
- `GET /documents/:id` — detail with items, parties, warehouses; requires `document.read`
- `POST /documents` — create draft; permission checked dynamically: `document.create.{type}`
- `PATCH /documents/:id` — update draft (replaces items); same dynamic permission
- `POST /documents/:id/confirm` — apply effects (stock, kardex, accounts); same dynamic permission
- `POST /documents/:id/void` — reverse movements, delete CxP; same dynamic permission
- `DELETE /documents/:id` — delete draft only; same dynamic permission
- **Strategy pattern**: `DocumentEffectsRegistry` maps type → strategy; add new types without touching service
- **Warehouse rule**: for all types except `T`, service always resolves the active `store`-type warehouse; client never sends `warehouseId` for non-transfer docs
- **Implemented strategies (phase 1)**: `CM` (purchase), `DVC` (supplier return), `EAI` (stock adjustment in), `SAJ` (stock adjustment out), `T` (transfer), `PV` (preventa — logical stock reservation, no physical movement)
- **BinStock population**: `BaseEffectStrategy.moveStock` upserts `BinStock` automatically whenever a `binId` is passed alongside `warehouseId`. `TransferEffectStrategy.confirm()` passes `binId` on **both** legs — `sourceBinId` on the origin/exit leg, `destBinId` on the destination/entry leg — when the respective warehouse is bin-tracked (`type: 'warehouse'`); both `validateCreate()` and `confirm()` verify each bin belongs to its stated warehouse (`Bin → Zone → Warehouse`), and `assertSufficientBinStock` guards the origin leg against insufficient bin-level stock (previously this was a known gap — the origin leg never passed `binId` — now resolved). `documents.service.ts::void()` mirrors this: when reversing a confirmed document it calls `applyBinStockChange` (not just `applyStockChange`) whenever the original movement had a `binId`, so voiding a confirmed transfer no longer leaves phantom stock in the source/dest bin — that gap used to silently break the `SUM(BinStock)===Inventory` invariant (Safety Rule). See `plans/007-binstock-traslados-inventario-real.md` (gitignored, local) for the broader gap analysis against the real warehouse inventory (talla, unidad de medida, carga masiva) — blocked on a stakeholder meeting.
- **Phase 2 types** (not yet implemented): `COT`, `POS`, `DVV`, `REM`, `RMDVC`, `PE` — each needs only a new Strategy class
- **Per-type cost UI in `ProductRow.tsx`** (frontend): `SAJ` never lets the user type a cost — `SajEffectStrategy` always uses the product's live `avgCost`, so the form shows it as read-only text (with a copy-to-clipboard button, for manually re-entering that exact value into a follow-up `EAI`) instead of an input. `EAI`'s cost is **mandatory and must be `> 0`** — see the `EAI` mandatory cost/reason bullet below; `CM`/`DVC` show a plain required cost input. Manually moving a product's full cost basis from one product to another (`SAJ` on the source + `EAI` on the destination) requires the operator to type the source's real `avgCost` into the destination `EAI` — there's no atomic "merge product" operation yet; see `plans/007-...` context and `tasks/pendiente-mejoras-operativas.md` (gitignored) for the fuller writeup.
- **`EAI` mandatory cost and adjustment reason (2026-08-10)**: `unitCost` used to be optional and silently fell back to the product's `avgCost` when omitted/zero — that let a typo (0, or a dropped digit) pass through unnoticed and corrupt `avgCost` for every sale afterward. Now `EaiEffectStrategy.validateCreate()` **and** `confirm()` both reject any item with `unitCost` missing or `<= 0` (double-checked because a `PATCH` on a draft bypasses `validateCreate()` — same reasoning as the bulto rule above). The old client-side "costo se desvía >30% del promedio" amber warning was deliberately removed (explicit user request) instead of being replaced with a stronger guard — a fat-fingered-but-nonzero cost (e.g. 5.000 vs 50.000) currently has **zero** friction; if that risk needs closing, revisit a mandatory-justification-on-deviation design. Every `EAI` document also now requires `adjustmentReason` (Prisma enum `EaiAdjustmentReason`: `negativo` | `inventario_general` | `traspaso_costo` | `otro`), validated the same double way. `negativo` and `inventario_general` are mechanically identical (system shows less stock than physically exists) but kept as separate categories purely for reporting: `negativo` is the day-to-day case, `inventario_general` is the ~once-a-year full physical count. `otro` requires `adjustmentReasonOther` (free text) to be non-empty. A "correct just the average cost, without moving any units" operation was explicitly discussed and rejected as impossible to build on top of `EAI`: `computeNewAvgCost`'s weighted-average formula makes a `quantity: 0` entry mathematically a no-op regardless of the typed cost — that use case would need a wholly separate "override `Product.avgCost` directly" operation, not an `EAI` variant.
- **`T` — one product per destination bin (2026-08-10)**: a `Bin` ("bulto") is a physical container meant to hold exactly one product at a time (same product may keep stacking/accumulating; a different product must wait until the bin is empty). Enforced in `TransferEffectStrategy` via `assertSingleProductPerDestBin` (rejects multi-product items when `destBinId` is set) and a relaxed `assertDestBinValid` (blocks only if the bin already holds a *different* product with `quantity > 0`, not any occupation) — checked in both `validateCreate()` and `confirm()` for the same PATCH-bypass reason as above. The frontend's `destBins` filter in `DocumentFormPage.tsx` mirrors this as a UX guardrail (an "occupied" bin still shows as selectable if every product it already holds is already on the current document). Legacy data that predates this rule is NOT auto-corrected — `pnpm run audit:bin-products` (`backend/scripts/audit-bin-multi-product.mjs`) only reports violations, read-only.
- **`SAJ`/`T` never persist `unitCost`/`subtotal` on `DocumentItem`** — their strategies only read the product's `avgCost` for the kardex movement, they never write a cost back onto the item (unlike `CM`/`DVC`/`EAI`, which do). `DocumentDetailPage.tsx` accounts for this: for those two types it derives `unitCost`/`subtotal` live from `item.product.avgCost` (`usesAvgCostFallback`) instead of reading the always-zero `item.unitCost`/`item.subtotal` fields, and labels the column "Costo unit. (prom.)" instead of the plain "Costo unit." to signal it's a live average, not a transactional cost. Requires `product.avgCost` to be included in `DocumentsService`'s `DETAIL_INCLUDE` — if a future query drops that field, this silently reverts to showing "—".
- **`void()` cost reversal (CM/EAI only)**: reverses `Product.avgCost` (via `computeReversedAvgCost`, the algebraic inverse of `computeNewAvgCost`) and, for `CM` only, `Product.lastCost` (via `resolveLastCostAfterVoidingCm` — EAI never writes `lastCost` in `confirm()`, so EAI movements are excluded from the fallback search; if a later live CM already exists for the product, `lastCost` is left untouched since it already reflects that later purchase). Guarded by a recency check that blocks the void if any OTHER document's negative (real consumption) movement — excluding `transfer` and `void` movement types, since neither represents real consumption — happened after the movement being voided; the weighted-average reversal is only exact absent intervening consumption. This logic is deliberately kept inline in `void()` (not a Strategy `reverseCost()` hook) despite the method's own "genérica por diseño" framing in its doc comment — a minimal-patch choice made when fixing 2026-07-27 code-review bugs, to keep scope/risk small; reconsider extracting a hook if a third cost-affecting type ever needs void-time reversal.
- **`PV` (Preventa) — logical stock reservation**: reserves inventory for a customer (`thirdPartyId` with a `Customer`) plus a seller (`sellerId`, must be a `ThirdParty` with `isSeller: true`) ahead of a real sale. Deliberately does **not** touch `Inventory`/`BinStock`/`InventoryMovement` — `PvEffectStrategy.confirm()` only validates `available = Inventory.quantity - reserved >= quantity` and never calls `moveStock`. The reservation is **derived, not stored**: `getReservedByProduct()` (`documents/helpers/reservation.helpers.ts`) sums `quantity - releasedQuantity - convertedQuantity` across confirmed `PV` documents on every read — there's no `StockReservation` aggregate table, so there's no second total that could drift out of sync with the invariant-protected `Inventory`/`BinStock` pair (Safety Rule). This also means `documents.service.ts::void()` needed **zero** changes for PV: it only reverses `InventoryMovement` rows, and PV never creates any, so voiding a preventa releases its reservation automatically the moment the derived sum stops counting it. Real-world context that shaped this: physically, reserved garments get moved into a seller-labeled basket in the warehouse — that's a manual process handled by warehouse staff outside this system, which is why the schema intentionally does not model a per-bin reservation location.
- **`PV` partial release**: `POST /documents/:id/release-items` (confirmed documents only) lets a user release less than the full reserved quantity per item — validated atomically against `quantity - releasedQuantity - convertedQuantity` via a guarded `UPDATE ... WHERE ... RETURNING` (same pattern as `applyStockChange`), and logged to `ReservationRelease` (append-only audit: who/when/how much). Voiding the whole document does **not** write to `ReservationRelease` — only partial releases do. Requires `document.release.PV`, kept separate from `document.create.PV`, since creating a preventa and releasing a customer's held stock are different authorities (e.g. a seller creates, a supervisor releases).
- **`PV` price-based valuation**: PV is the first document type valued at `unitPrice` (sale price) instead of `unitCost`. `DocumentsService.computeTotal`/`computeItemSubtotal` branch on a `PRICE_BASED_TYPES` set — currently only `PV` — so `CM`/`DVC`/`EAI`/`SAJ`/`T` keep computing off `unitCost` exactly as before. A future price-based type (`COT`/`POS`) just needs adding to that set.
- **`PV` → `POS`/`COT` conversion — not implemented**: `Document.sourceDocumentId` (self-relation), `DocumentItem.convertedQuantity`, and `ReservationEffectStrategy.consumeForConversion?()` exist as extension points but are unused — `POS`/`COT` are still phase 2 (no Strategy class). The frontend's "Convertir a venta" button on a confirmed PV is a disabled placeholder (native tooltip only, no `onClick` logic) so the feature stays visible as a reminder without pretending to work.
- **`PV` permission seed — deliberately not granted to `purchasing`/`billing`**: `document.create.PV`/`document.release.PV`/`document.convert.PV` were seeded only to `admin` and `basket_management`. `purchasing` holds `document.create.REM` (a pre-existing quirk — a procurement role holding a sales-document permission), but PV wasn't added there to avoid propagating that inconsistency further. `billing` holds `DVC`/`RMDVC`, whose seed comments say "sales invoice"/"sales invoice return" even though both are actually purchase-return document types per the schema — that comment is misleading and worth fixing independently, but it doesn't imply `billing` should get PV. Revisit if the business actually wants either role to create/release preventas.

**AccountsPayableModule**:

- `GET /accounts-payable` — list paginated, filters by `status`/`supplierId`/`search` (supplier name); requires `ap.read`
- `GET /accounts-payable/:id` — detail with `supplier.thirdParty`, `document`, `payablePayments` (desc); requires `ap.read`
- `POST /accounts-payable/:id/payments` — register a payment; requires `ap.manage`. Runs in `$transaction`, opens with `SELECT id FROM accounts_payable WHERE id = $1 FOR UPDATE` to serialize concurrent payments against the same account (prevents overpayment from a race), validates payment doesn't exceed pending balance (compared in integer cents via `toCents()` to avoid float drift), recomputes `status` (`pending` | `partial` | `paid`)
- Created automatically by `CM` document strategy on confirm; deleted on void (blocked if it already has `payablePayments` or `creditApplications` — see below, a payment settled 100% by credit creates no `PayablePayment` row so both must be checked)
- **Supplier credit (nota crédito de proveedor)**: `DvcEffectStrategy.confirm()` creates a `SupplierCredit` (positive `balance`, `status: 'available'`) instead of a negative `AccountsPayable`. `POST /accounts-payable/:id/payments` accepts an optional `creditApplications[]` array (`{ supplierCreditId, amount }`) alongside cash `amount` (which may be `0` for a 100%-credit payment); both settle against the same pending balance, validated together in cents inside the existing `FOR UPDATE`-locked `$transaction`. `GET /accounts-payable/credits?supplierId=` lists available credits (declared before `GET /:id` in the controller — same route-order rule as `GET /auth/roles`). Voiding the DVC that generated a credit is blocked if that credit has any `SupplierCreditApplication`; voiding an unapplied DVC hard-deletes its `SupplierCredit` row (`documents.service.ts::void()`).
- **Not unified with `AccountsReceivable`**: a pre-existing, unused `CustomerCredit` model with a near-identical shape was removed (2026-07-27) rather than generalized into a shared `Credit`/`CreditApplication` model — consulted `software-architect`/`prisma-db-architect` first; both recommended against unifying now, since AR has no credit-application consumer yet (YAGNI) and the natural unified design (dual-nullable FK + `CHECK`) loses type-level guarantees Prisma can't express declaratively. When AR implements its own return-credit flow (`DVV`), build a parallel `CustomerCredit`/`CustomerCreditApplication` pair and share the *service-level* validation logic (cents-based balance check + ordered `FOR UPDATE` locking), not the schema.

**AccountsReceivableModule**:

- Mirrors `AccountsPayableModule` exactly, client side instead of supplier side — same endpoints (`GET /accounts-receivable`, `GET /accounts-receivable/:id`, `POST /accounts-receivable/:id/payments`), same `$transaction` + cents-based balance validation pattern + `SELECT ... FOR UPDATE` row lock, requires `ar.read` / `ar.manage`
- **Schema differences from AccountsPayable — do not copy blindly**: `AccountsReceivable` has two party relations (`client` via `Customer.thirdParty`, and `seller` via `ThirdParty` directly, relation name `SellerAR`) instead of AP's single `supplier`; `ReceivablePayment` has no `bankDestination` field (AP's `PayablePayment` does)
- Not yet wired to any document strategy (sales document types `COT`/`POS`/`DVV` are still Phase 2 — see DocumentsModule below), so records currently must be created manually until those strategies exist

**SystemConfigModule** — modo de solo lectura (cierre contable mensual):

- `GET /system/status` — snapshot actual (`readOnlyMode`, `activatedAt`, `activatedBy`); JWT required
- `GET /system/status/stream` — SSE (`@Public()`, JWT viaja como `?token=` porque `EventSource` no puede mandar `Authorization`; se valida manualmente con `JwtService.verify()`). Un token ausente/inválido lanza `UnauthorizedException` (no emite un `MessageEvent` de error) — así Nest nunca llega a fijar los headers SSE y la respuesta es un 401 HTTP normal, que el `EventSource` del navegador interpreta como "fail the connection" (sin reintentos). Emitir el error como mensaje SSE en cambio rompía el contrato esperado por el frontend, porque el `ResponseFormatInterceptor` global envuelve también las emisiones `@Sse()`
- `POST /system/read-only/toggle` — activa/desactiva; requiere `system.manage` **y** `@BypassReadOnly()` (sin este segundo decorador nadie podría desactivar el modo una vez encendido)
- **`ReadOnlyModeGuard`** — 3er `APP_GUARD` global (junto a `JwtAuthGuard`/`PermissionsGuard`); bloquea `POST/PATCH/PUT/DELETE` con 403 si `readOnlyMode` está activo, salvo rutas marcadas `@Public()` o `@BypassReadOnly()`
- **Caché en memoria, no multi-instancia**: `SystemConfigService.getStatus()` lee un `BehaviorSubject` en memoria (síncrono, sin golpear la DB — el guard lo llama en cada request de escritura). Asume un único proceso backend; si se despliega alguna vez en cluster/réplicas, cada instancia tendría su propio caché desincronizado y el toggle solo aplicaría en la instancia que lo recibió. No hay despliegue multi-instancia hoy — si eso cambia, esto necesita pub/sub o polling a la DB antes de confiar en el guard
- Fila única en `SystemConfig` (sin constraint de unicidad a nivel de DB, solo por convención de `findFirst()`/seed)

**CommonModule** (`src/common/`):

- `decorators/permissions.decorator.ts` — `@Permissions(...perms)` sets required permissions via SetMetadata
- `decorators/public.decorator.ts` — `@Public()` marks a route as unauthenticated (skips JWT guard)
- `guards/jwt-auth.guard.ts` — global guard (registered via `APP_GUARD` in `AppModule`); checks `IS_PUBLIC_KEY` via Reflector before validating Bearer token; throws 401 on failure
- `guards/permissions.guard.ts` — global guard (registered via `APP_GUARD`); checks `request.user.permissions` against required perms, throws 403 if missing. `@Permissions` can be placed at class level (applies to all methods) or method level (overrides class)
- `filters/prisma-exception.filter.ts` — maps Prisma errors to HTTP responses (Spanish messages)
- `interceptors/response-format.interceptor.ts` — wraps responses as `{ success: true, data: T }`
- `enums/index.ts` — exports `MovementType`, `DocumentType`, `DocumentStatus`
- `types/index.ts` — exports `JwtPayload`, `RequestWithUser`, `ResponseFormat<T>`

### Authentication & Authorization

JWT includes the user's full permission set (loaded from Role → RolePermission → Permission at login time). Guards check against this in-token permissions array — no per-request DB lookup needed.

RBAC roles defined in seed: `admin`, `purchasing`, `warehouse`, `basket_management`, `billing`, `accounts_admin`, `accounts_assistant`. The last two both get full `ar.*`/`ap.*` (CxC + CxP) — they are hierarchical, not module-scoped: `accounts_admin` additionally has `user.manage`, `accounts_assistant` does not.

Permissions are namespaced by module: `products.*`, `documents.*`, `warehouses.*`, `third_parties.*`, `accounts.*`, `cash.*`, `users.*`, `labels.*`.

### Database (Prisma + PostgreSQL)

Schema: `backend/prisma/schema.prisma`. Uses `@prisma/adapter-pg` for connection pooling.

Key domain models and their relationships:

- **ThirdParty** → base for `Customer` and `Supplier` (one-to-one)
- **Product** — has pricing (`salePrice`, `minSalePrice`) and costing (`avgCost`, `lastCost`). No stock cache field — stock is always queried from `Inventory`. `unitOfMeasure` (`unidad` | `docena`, default `unidad`) is **purely informational** — it does not multiply/convert quantity anywhere; it only surfaces as a label in the transfer (`T`) document item row (`ProductRow.tsx`) so the operator knows how that product is physically counted. A full docena↔unidad conversion system is still blocked on the stakeholder meeting referenced in `plans/007-binstock-traslados-inventario-real.md` (gitignored, local) — don't assume `unitOfMeasure` implies any calculation exists.
- **Warehouse → Zone → Bin** — three-level location hierarchy. `Warehouse.type` is a `WarehouseType` enum (`store` | `warehouse`). `GET /warehouses/:id` computes a non-persisted `occupied: boolean` per bin (`SUM(BinStock.quantity) > 0` for that bin) — the frontend's transfer destination-bin selector (`DocumentFormPage.tsx`) filters to `occupied === false` only, since a bin ("bulto") is a reusable physical container that shouldn't receive a second transfer while it still holds stock from a prior one. This is deliberately NOT a mutable schema field (no manual "usado/libre" toggle) — it's always derived live from `BinStock` so it can never drift out of sync; it becomes available again automatically once its stock is fully moved out. The warehouse admin UI (`DetailPanel.tsx`) still lists all bins regardless of `occupied`.
- **Inventory** — current stock per `(productId, warehouseId)` composite PK. `quantity` is `Int`. Query this table for stock totals (used by sales/POS). Never cache on Product.
- **BinStock** — bin-level stock per `(productId, binId)` composite PK. Has denormalized `warehouseId` to avoid 3-level JOIN. Only populated by transfer documents (type `T`). Purchases (CM) only update `Inventory` — all incoming stock enters the warehouse without bin assignment. Invariant: `SUM(BinStock.quantity WHERE warehouseId=W) === Inventory.quantity WHERE warehouseId=W`.
- **InventoryMovement** — append-only audit trail; `type` enum: `purchase | sale | return | transfer | adjustment | initial_stock | void | production`. `quantity`, `previousStock`, `newStock` are `Int`.
- **DocumentItem** — `quantity` is `Int`. Costs/prices (`unitCost`, `unitPrice`, `subtotal`) remain `Decimal`.
- **Document + DocumentItem** — unified transaction document supporting types: `CM, DVC, RMDVC, PE, EAI, SAJ, COT, POS, REM, DVV, T`
- **AccountsReceivable / AccountsPayable** — payment tracking with credit support
- **User → UserRole → Role → RolePermission → Permission** — full RBAC graph

### Conventions

- **Path alias**: `@/*` maps to `src/*` (configured in `tsconfig.json`). Verified working at build time: `nest build`'s compiler resolves `@/` to relative paths in the emitted `dist/` output, so it's safe at runtime too. **Import rule (hybrid — matches `import/no-relative-parent-imports`, Airbnb/Google style guides): use `@/` only when the import would otherwise need to go up a directory (`../`). Same-directory or subdirectory-of-current-directory imports (`./create-x.dto`, `./strategies/index`) stay relative.** This keeps modules portable (movable without rewriting their internal imports) and preserves `./` as a signal of "lives right next to me" vs `@/` as "cross-cutting dependency from elsewhere in the app." Example: `documents/dto/index.ts` re-exporting `./create-document.dto` stays relative (same folder); a file needing something from `common/` two levels up uses `@/common/x` instead of `../../common/x`.
- **Response format**: Always `{ success: boolean, data: T }` — the interceptor handles wrapping; `message` is optional
- **Error messages**: Spanish language (matches existing filter messages)
- **Passwords**: bcrypt, 10 salt rounds
- **Config**: All secrets via `ConfigService` from `.env` (`DATABASE_URL`, `JWT_SECRET`)

---

## Frontend (EloSC)

### Commands

All commands run from the `frontend/` directory using `pnpm`.

```bash
pnpm dev          # Start Vite dev server
pnpm build        # Production build
pnpm preview      # Preview production build
pnpm lint         # ESLint
```

### Testing frontend changes

When verifying any frontend behavior end-to-end (forms, flows, bug fixes), use the **Playwright CLI in headed mode** — write an ad-hoc script using the `playwright` package already installed in `frontend/` (`chromium.launch({ headless: false })`) and run it with `node`. Not the chrome-devtools MCP tools, not headless. The user wants to see the browser window while the flow runs.

### Key Patterns

**API responses** — Backend wraps everything as `{ success, data: T }`. Services unwrap before returning:
```ts
const res = await api.get<ApiResponse<T>>('/endpoint', { params })
return res.data.data
```

**Queries** — Always include `staleTime: 5 * 60 * 1000` to avoid redundant refetches on cached keys. Use `keepPreviousData` on paginated/searchable lists to prevent flicker.

**Debounced search** — 400 ms debounce via `useEffect` + `setTimeout`; reset `page` to 1 when search changes.

**Pagination** — Backend returns `{ items, meta: { total, page, limit, totalPages } }`. Query key includes `[..., page]`. Pagination controls show ellipsis for large page counts.

**Mutations** — Always call `queryClient.invalidateQueries({ queryKey: ['resource'] })` on success.

**Logout dropdown** — Built with `useState` + `useRef` + `document.addEventListener('mousedown', ...)` for click-outside detection. No external library.

**Row click to edit** — Every list page `<tr>` must have `onClick={() => setEditing(item)}` and `cursor-pointer`. The delete button must call `e.stopPropagation()` to prevent bubbling. The pencil button also gets `e.stopPropagation()` (it becomes redundant but keeps explicitness). Apply this pattern to every new module.

**Protected routes** — `AuthGuard` checks `useAuthStore` token; redirects to `/login` if not authenticated.

**Shared SSE connection (`useSystemStatus`)** — Module-level singleton (`sharedEventSource`, `activeSubscribers` ref-count) instead of one `EventSource` per component: `Header` and `AppLayout` both call the hook, but only the first mounted consumer opens the connection and the last one to unmount closes it. `staleTime: Infinity` on the underlying query — it's never refetched by time, only ever updated by the SSE push (including the mutation that toggles the mode itself, via `queryClient.setQueryData` in `Header.tsx`, so the acting user's own UI doesn't depend on their SSE round-tripping back to them). Reuse this module-level-singleton pattern for any future SSE hook — don't spin up a new `EventSource` per component instance.

**Combobox (shared)** — Use `<Combobox>` from `@/components/shared` for all searchable dropdowns. Two modes: (1) **Controlled** — pass `searchValue`/`onSearchChange` for server-side debounce; show "Escribe para buscar..." when empty, let caller manage `enabled` on the query; (2) **Uncontrolled** — omit both props, component filters `options` client-side. Always uses `createPortal` → safe inside overflow containers. Option interface: `{ id, label, sublabel? }`. `onChange` signature: `(id: string, option: ComboboxOption) => void`. For server-side search, add a synthetic option when an item is already selected and search is empty (prevents the trigger showing blank). It has no keyboard support (no Enter-to-select, no arrow-key nav) — every selection is mouse-only; that's why the barcode-scan flow (see `frontend/src/pages/documents/CLAUDE.md`) needed its own dedicated input instead of reusing it.

**`minSalePrice` auto-fill** — `ProductForm.tsx` auto-computes "Precio mínimo de venta" as `salePrice * 0.98` (business rule: 2% floor discount) while creating a product, live as `salePrice` is typed. Stops overwriting the moment the user edits `minSalePrice` by hand (tracked via a `minSalePriceTouched` flag, reset on every form open) — never auto-fills in edit mode, only on create.

**Permission-based UI** — Use `usePermission(...perms)` from `@/hooks/usePermission` to show/hide UI elements. The JWT already carries `permissions[]` so no extra request is needed. Pattern:
```tsx
const canManage = usePermission('user.manage')
// Hide action buttons, sidebar sections, entire CTAs:
{canManage && <button>Nuevo usuario</button>}
```
For sidebar sections that must be hidden for some roles, render the `<NavLink>` conditionally inside the component (not in the static `navGroups` array). See `Sidebar.tsx` "Administración" section as reference.

**Sidebar accordion nav items** — When a nav section needs collapsible sub-items (e.g. Bodegas), create a dedicated component (`WarehousesSidebarItem`) instead of a static NavLink. Use `useLocation` + `useState` for open/close; `max-height` CSS transition for animation; `useQuery` to load sub-items from API. Sub-item links use `Link` (not `NavLink`) with manual `isActive` computed from `location.search` — React Router's NavLink `isActive` ignores query params and would mark all sub-items active simultaneously.

**Lazy route loading** — `router/index.tsx`'s `Lazy` wrapper uses a `DelayedPageLoader` (200ms `setTimeout` before rendering `PageLoader`) as the `Suspense` fallback, not `PageLoader` directly. Route chunks that resolve faster than 200ms (already-loaded chunks, fast dev-server reloads) never show the full-screen loader — only genuinely slow loads do. Don't revert this to a bare `<PageLoader />` fallback; it reintroduces a flash on every navigation.

**Theme toggle animation** — `Header.tsx`'s theme button uses the View Transition API (`document.startViewTransition`) for an expanding-circle wipe, with a plain `toggleTheme()` fallback when unsupported. Three gotchas if touching this: (1) wrap the state update in `flushSync` inside the transition callback — the `.dark` class toggle in `AppLayout.tsx`'s `useEffect` must apply synchronously before the browser snapshots the new state; (2) `index.css` resets `mix-blend-mode: normal` on `::view-transition-old(root)`/`::view-transition-new(root)` — Chrome's default `plus-lighter` blend additively mixes the two layers during a clip-path reveal, producing a color-flash; (3) the reveal keyframe animation needs `fill-mode: forwards`, otherwise `clip-path` snaps back to `circle(0%)` the instant the animation ends, flashing the old theme for a frame.

**Role display names** — Spanish labels for roles live in `users.service.ts` as `ROLE_LABELS: Record<string, string>` with a `getRoleLabel(name)` helper that falls back to `replace(/_/g, ' ')`. Import from there when displaying role names anywhere in the UI.

### Implemented Modules

| Route | Status | Notes |
|-------|--------|-------|
| `/login` | Done | JWT auth, redirects to `/` if already logged in |
| `/` (dashboard) | Partial | Stats cards — Terceros shows real count, rest are static `—` |
| `/third-parties` | Done | Full CRUD, server-side search, debounce, pagination, cache |
| `/products` | Done | Full CRUD, server-side search, debounce, pagination, cache, stock column (total + per-warehouse breakdown), cost columns ("Costo Prom." / "Últ. Costo") |
| `/warehouses` | Partial | Full CRUD warehouses + zones/bins (backend controllers implemented); sidebar accordion shows sub-items per warehouse; URL-based selection via `?id=` |
| `/documents` | Done | List + form (create/edit/confirm/void), portal Combobox, search-on-type |
| `/users` | Done | Full CRUD, role checkboxes, password confirmation, permission-gated sidebar |
| `/accounts-receivable` | Placeholder | ComingSoonPage |
| `/accounts-payable` | Placeholder | ComingSoonPage |

### Design Tokens

All colors and gradients are tokenized — **never use hardcoded hex values** in components.

**Color classes** (defined in `src/index.css` `@theme`):
- `bg-brand-primary` / `text-brand-primary` — `#141a17` (sidebar, dark surfaces)
- `bg-brand-secondary` / `text-brand-secondary` — `#07bc34` (CTAs, active states)
- `bg-brand-surface` — `#1e2820` (dropdowns on dark backgrounds)
- `bg-brand-primary-dark` — `#0d1210` (page background on login)
- Opacity modifiers work natively: `bg-brand-secondary/10`, `bg-brand-primary/15`

**Gradient utilities** (use as className, never as inline `style`):
- `gradient-action` — green CTA: buttons, active pagination
- `gradient-dark` — dark surface: empty state icons
- `gradient-user` — user avatars: dark-to-green
- `nav-active` — sidebar active NavLink
- `glass` — glassmorphism for dark panel forms
- `text-gradient-brand` — green gradient text for hero copy

### Typography

Fonts loaded in `index.html` from Google Fonts. Applied globally via `@layer base` in `src/index.css`.

| Font | Weight | Applied to | Class |
|------|--------|------------|-------|
| Prompt | Black 900 | h1–h6 (automatic) | — |
| Barlow | Regular 400 | Body text (default) | `font-sans` |
| Barlow | Medium Italic 500 | Subtitles, supporting text | `font-accent` |

**Rule:** Do not add `font-bold` to headings — Prompt Black is applied automatically. Use `font-accent` for subtitle/description text (e.g., page subtitles, date labels, placeholder descriptions).

### UI Conventions

- Error messages in **Spanish** (matches backend)
- Toast pattern: `toast.success` / `toast.error` / `toast.info` (Sonner)
- All stats show `animate-pulse` skeleton while loading, never blank/undefined
- Action buttons hidden (`opacity-0`) on table rows, revealed on `group-hover`
- Path alias `@/*` → `src/*` (same as backend). **Import rule (hybrid — matches `import/no-relative-parent-imports`, Airbnb/Google style guides): use `@/` only when the import would otherwise need to go up a directory (`../`). Same-directory or subdirectory-of-current-directory imports (`./components/X`, `./x.constants`) stay relative.** This keeps feature folders portable (movable without rewriting their internal imports) and preserves `./` as a signal of "lives right next to me" vs `@/` as "cross-cutting dependency from elsewhere in the app." Example: `pages/accounts-payable/AccountsPayableDetailPage.tsx` importing its own `./components/StatusBadge` stays relative; that same component reaching up one level for `../accounts-payable.constants` becomes `@/pages/accounts-payable/accounts-payable.constants` instead.

### Shared Components

`components/shared/` contains reusable primitives for all list/table pages. **Always import from the barrel** `@/components/shared`, never from individual files.

```tsx
// ✅ correct
import { Combobox, StatsGrid, TableToolbar, TableSkeleton, EmptyState, ErrorState, TablePagination } from '@/components/shared'

// ❌ wrong — bypasses barrel
import { StatsGrid } from '@/components/shared/StatsGrid'
```

| Component | Key props | Use when |
|-----------|-----------|----------|
| `Combobox` | `value`, `onChange(id, opt)`, `options: ComboboxOption[]`, `searchValue?`, `onSearchChange?`, `isLoading?`, `placeholder?`, `disabled?`, `error?` | Searchable dropdown. Controlled mode (pass `searchValue`/`onSearchChange`) for server-side debounce; uncontrolled (omit both) for small client-side datasets. Uses `createPortal` — safe inside overflow containers. |
| `StatsGrid` | `cards: StatCard[]`, `isLoading` | 3-card stat row at top of every list page |
| `TableToolbar` | `search`, `onSearchChange`, `placeholder`, `isLoading`, `itemCount`, `total`, `onRefresh` | Search + count + refresh bar above table |
| `TableSkeleton` | `rows?`, `widths: [w1, w2, w3, w4]` | Animated placeholder while data loads |
| `EmptyState` | `icon`, `title`, `description` | No-data / no-results state inside table |
| `ErrorState` | `message`, `onRetry` | Fetch error state inside table |
| `TablePagination` | `page`, `totalPages`, `total`, `onPageChange` | Footer pagination; auto-hides if `totalPages ≤ 1` |
| `PageLoader` | — | Full-page branded loading spinner |

**Rule:** Before writing inline skeleton, error state, empty state, stats grid, toolbar, pagination, or searchable combobox in a new page — check this list first and use the shared component.

**Component splitting rule** — Extract an inline component when: (a) it exceeds ~100 lines AND has a clearly differentiable responsibility, OR (b) it's duplicated in 2+ files. Do NOT extract when: it's <50 lines and used only once, or when extraction adds more indirection than clarity. Helpers that are just styled wrappers (~10-15 lines) stay inline. Pages >600 lines should be reviewed for extractable sections.

### Dark Mode — MANDATORY for every new component

The app has a dark/light toggle. **Every component must be dark-mode-ready from the start.** The rule is simple: never use hardcoded Tailwind gray classes. Use semantic tokens instead.

| Instead of… | Use… |
|-------------|------|
| `bg-white` | `bg-surface` |
| `bg-gray-50` (elevated area, toolbar, footer) | `bg-surface-raised` |
| `bg-gray-100` (hover state, skeleton) | `bg-surface-hover` |
| `hover:bg-gray-50` | `hover:bg-surface-raised` |
| `hover:bg-gray-100` | `hover:bg-surface-hover` |
| `border-gray-50` / `divide-gray-50` | `border-ui-divide` / `divide-ui-divide` |
| `border-gray-100` | `border-ui-border` |
| `border-gray-200` | `border-ui-border-medium` |
| `text-gray-900` / `text-gray-800` | `text-content` |
| `text-gray-700` / `text-gray-600` | `text-content-secondary` |
| `text-gray-500` | `text-content-muted` |
| `text-gray-400` / `text-gray-300` | `text-content-faint` |
| `bg-gray-50` (page background) | `bg-page` |

**Inline styles with hex colors are forbidden.** Replace with CSS utility classes:
- `style={{ background: 'linear-gradient(135deg, #141a17, #1f2b24)' }}` → `className="gradient-dark"`
- `style={{ background: 'linear-gradient(135deg, #07bc34, #059928)' }}` → `className="gradient-action"`
- `style={{ background: '#141a17' }}` → `className="bg-brand-primary"`

**Status / category pill badges** use Tailwind color classes (green, blue, amber…) which are acceptable, but must include dark-mode variants:
```tsx
// ✅ correct
'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'

// ❌ wrong — no dark variant
'bg-green-100 text-green-700'
```

The `dark:` variant works because `@custom-variant dark (&:is(.dark *))` is declared in `index.css` and `<html class="dark">` is toggled by `useThemeStore` via `AppLayout`.

---

## Routing Rules

Defines when to delegate to a subagent or invoke a skill. **Read the trigger condition; if it matches, invoke that tool BEFORE generating any response.** Triggers are written en lenguaje natural — reconocer la intención aunque la frase exacta difiera.

### Subagents

| Trigger | Subagent | Notes |
|---------|----------|-------|
| Cualquier implementación de frontend: crear O modificar páginas, componentes, hooks, features, formularios, tablas, secciones — "hazme una página de…", "agrega el módulo de…", "necesito la pantalla de…", "crea el form para…", "arregla el bug en…", "cambia el componente de…", "edita la tabla de…", "modifica el form de…" | `react-code-crafter` | Invocar skill `vercel-react-best-practices` ANTES de lanzar el agente, e incluir las reglas relevantes en el prompt. Genera código React alineado con los patrones del proyecto (TanStack Query, react-hook-form, tokens de diseño, debounce, paginación) |
| Cualquier implementación de backend NestJS: crear O modificar módulos, controllers, services, DTOs, guards, interceptors, estrategias — "agrega el endpoint de…", "crea el módulo de…", "arregla el bug en el service de…", "cambia el controller de…", "implementa la estrategia para…" | `nestjs-code-crafter` | Invocar skill `nestjs-best-practices` ANTES de lanzar el agente, e incluir las reglas relevantes en el prompt. Genera código NestJS alineado con la arquitectura del proyecto (RBAC, DTOs, Prisma, response format, regla híbrida de imports); respeta las Safety Rules — si la tarea toca AuthModule/migraciones/bootstrap/seed RBAC/invariante BinStock, debe detenerse y pedir confirmación en vez de proceder |
| Base de datos / Prisma: "agrega índices", "revisa el schema", "audita las tablas", "optimiza queries", "mira mis tablas", "hay duplicados en…", "el query es lento", "diseña las tablas para…", "cómo modelar…" | `prisma-db-architect` | Audita schema.prisma, identifica índices faltantes, modela relaciones, optimiza queries |
| Exploración de código abierta >3 búsquedas: "¿dónde está X?", "¿qué archivos usan Y?", "busca dónde se define…" | `Explore` | Solo lectura; no usar para review ni análisis cross-file profundo |
| Investigación compleja multistep o búsqueda sin dirección clara | `general-purpose` | Cuando Explore o Grep solos no son suficientes |
| Diseñar arquitectura o planificar antes de implementar: "¿cómo deberíamos estructurar…?", "diseña el flujo de…", "planifica la implementación de…", "qué enfoque recomiendas para…" | `Plan` | Devuelve plan paso a paso antes de implementar |
| Preguntas sobre Claude Code CLI, hooks, settings, Agent SDK, API de Anthropic | `claude-code-guide` | Verificar si hay un agente activo antes de lanzar uno nuevo |

### Skills — Diseño UI / Frontend

| Trigger | Skill |
|---------|-------|
| Preguntas sobre diseño visual, UX, colores, qué se ve mejor, cómo mejorar visualmente, jerarquía, layout, espaciado, qué color usar, iconos, contraste, modo oscuro, dashboard looks, recomendación de UI — "¿cómo se ve?", "¿qué recomiendas para…?", "¿queda bien así?", "mejora el diseño de…", "hay mucho verde", "quiero variedad de colores", "no me gusta cómo se ve" | `interface-design` |
| Cualquier trabajo de frontend React: crear, modificar, revisar, o hablar sobre componentes, páginas, hooks, estado, performance, bundle — siempre invocar antes de delegar al agente `react-code-crafter` | `vercel-react-best-practices` |
| TypeScript avanzado: genéricos, tipos condicionales, mapped types, infer, utility types, errores de tipo difíciles | `typescript-advanced-types` |

### Skills — Backend NestJS / Node.js

| Trigger | Skill |
|---------|-------|
| Crear o revisar módulos NestJS: providers, guards, interceptors, pipes, decorators, módulos, controladores — "cómo hago un guard", "necesito un interceptor", "agrega un pipe de validación" — siempre invocar antes de delegar al agente `nestjs-code-crafter` | `nestjs-best-practices` |
| Patrones de middleware, autenticación JWT, error handling, diseño de endpoints REST, rate limiting, CORS — "cómo manejo el error de…", "cómo estructuro este endpoint", "necesito middleware para…" | `nodejs-backend-patterns` |
| Decisiones de arquitectura Node.js: framework, async/await patterns, seguridad, variables de entorno, estructura de proyecto | `nodejs-best-practices` |

### Skills — Prisma / Base de Datos

| Trigger | Skill |
|---------|-------|
| Comandos CLI de Prisma: `migrate`, `generate`, `db push`, `studio`, `seed`, `introspect` — "cómo corro la migración", "el generate está fallando" | `prisma-cli` |
| Escribir queries Prisma: `findMany`, `create`, `update`, `upsert`, `$transaction`, `include`, `select`, filtros, paginación — "cómo hago un query que…", "necesito filtrar por…" | `prisma-client-api` |
| Configurar Prisma con PostgreSQL, MySQL, SQLite, MongoDB — conexión, datasource, adapter | `prisma-database-setup` |
| Prisma Postgres cloud (Console, Management API) | `prisma-postgres` |

### Skills — Calidad de Código
| Trigger | Skill |
|---------|-------|
| Revisar código por bugs, correctness o reutilización: "revisa el diff", "revisa el PR", "¿está bien esto?", "busca errores en…" | `code-review` |
| Simplificar o refactorizar: "simplifica esto", "está muy largo", "refactoriza el código de…", "hay mucha repetición" | `simplify` |
| Revisión de seguridad: "¿es seguro esto?", "revisa vulnerabilidades", "hay algún problema de seguridad" | `security-review` |
| Verificar que algo funciona en la app: "confirma que el fix está bien", "prueba que funciona", "¿quedó bien el cambio?" | `verify` |
| Arrancar la app o mostrar resultado en pantalla: "corre el proyecto", "muéstrame cómo queda", "arranca el servidor" | `run` |
| Revisar un PR de GitHub por número: "revisa el PR #N" | `review` |

### Skills — Claude API

| Trigger | Skill |
|---------|-------|
| Mención de modelos claude-*, Anthropic API, Opus/Sonnet/Haiku, streaming, tool use, MCP, caching de tokens, precios de modelos | `claude-api` |

### Skills — Configuración de Claude Code

| Trigger | Skill |
|---------|-------|
| Cambiar comportamiento de Claude Code: "desde ahora cuando X…", "agrega permiso para…", "configura el hook…", "quiero que siempre…", cambios a `settings.json` | `update-config` |
| Cambiar atajos de teclado: "cambia el shortcut de…", "reasigna la tecla…", `keybindings.json` | `keybindings-help` |
| Reducir prompts de permisos repetitivos | `fewer-permission-prompts` |

### Skills — Automatización

| Trigger | Skill |
|---------|-------|
| Repetir una tarea periódicamente: "ejecuta X cada N minutos", "repite este comando", "corre esto en loop" | `loop` |
| Programar una tarea a una hora específica: "programa esto para las 3pm", "crea un cron job" | `schedule` |

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
