# Proposal: Inventory Index Audit — Close Missing Index Gaps on `InventoryMovement`

## Intent

The index audit of the inventory module (see `sdd/auditoria-indices-inventario/explore`) found two concrete gaps on the `InventoryMovement` table, both on read paths exercised by document voiding (`documents.service.ts::void()`):

1. **`InventoryMovement.documentId` has no index despite being a foreign key.** Prisma does not auto-index FKs on PostgreSQL — the schema itself documents this on the `Document` model — and the sibling ledger models in the same schema (`EgresoAllocation`, `SupplierCreditApplication`, `ReservationRelease`) all declare `@@index([documentId])`. `InventoryMovement` is the outlier. `void()` performs `document.findUnique({ include: { inventoryMovements: {...} } })`, which Prisma translates into a filter on `document_id`. `inventory_movements` is an append-only ledger (one row per line of every confirmed document) that only grows, so today every void degrades toward a full sequential scan of the largest-growing table in the module.

2. **No composite index supporting `(productId, createdAt)`.** Two `findFirst` calls in the cost-reversal path (`stock.helpers.ts::resolveLastCostAfterVoidingCm` and `documents.service.ts::void()` ~line 736) filter on `productId` and then filter/sort on `createdAt`. All four existing indexes on the table are single-column, so PostgreSQL can use at most one as an access path and must sort/filter the remainder in memory.

**Why now**: the gap is cheap to close, the fix is purely additive, and the cost of leaving it grows monotonically with ledger size. Gap 1 also restores consistency with a convention this schema already applies everywhere else.

**What success looks like**: both queries are index-backed, the schema is internally consistent with its own FK-indexing convention, and no existing behavior, stock invariant, or query result changes.

## Scope

### In Scope

- Add `@@index([documentId])` to the `InventoryMovement` model in `backend/prisma/schema.prisma`.
- Add `@@index([productId, createdAt])` to the same model.
- Create one **additive, non-destructive** manual migration (`CREATE INDEX` only, no `DROP`, no column/table change) following the documented workaround in `backend/CLAUDE.md`.
- Regenerate the Prisma client and confirm the backend test suite (`pnpm test`) and build still pass.
- Update `backend/CLAUDE.md` with the FK-indexing convention if it is not already stated there (per `openspec/config.yaml` `rules.specs`).

### Out of Scope

- **`BinStock.@@index([warehouseId, productId])` — deliberately untouched.** No `where: { warehouseId }` usage on `BinStock` exists in versioned `backend/src`. The index matches exactly the query shape the `SUM(BinStock.quantity WHERE warehouseId=W) === Inventory.quantity WHERE warehouseId=W` Safety-Rule audit would need, and `package.json` references `scripts/audit-binstock-invariant.mjs`, which is gitignored and therefore not inspectable. Removing it without reading that script risks silently breaking the invariant auditor. **Requires the user to confirm the script's contents before any decision — deferred to a separate change.**
- **`Product.@@index([createdAt])` possible redundancy — deliberately untouched.** Low confidence: it coexists with `[active,createdAt]` and three `[active,X,createdAt]` variants, and `products.service.ts::findAll` always carries an `active` filter, but callers outside the services already reviewed (reports, exports) were not exhaustively checked. Dropping an index is irreversible-in-effect at query-plan level and needs stronger evidence. **Deferred pending a wider caller sweep.**
- Dropping or replacing the existing standalone `@@index([productId])`. Even though `[productId, createdAt]` makes it a prefix-redundant candidate, this change stays strictly additive; any removal is a separate, evidence-backed decision.
- Any change to the stock write paths (`applyStockChange` / `applyBinStockChange`). They use raw SQL against composite primary keys and are already optimally indexed and atomic.
- Anything covered by the root `CLAUDE.md` Safety Rules other than the migration itself: `AuthModule`/JWT contract, `main.ts` global bootstrap wiring, and RBAC seed data are untouched.
- Query rewrites, new endpoints (kardex/reports), or `EXPLAIN`-driven tuning beyond the two indexes above.

## Capabilities

### New Capabilities

- `inventory-movement-indexing`: the data-access performance contract for the `InventoryMovement` ledger — which access paths (FK joins from `Document`, product-scoped cost reversal lookups) MUST be index-backed, and the schema convention that FK columns participating in Prisma relation `include`s are explicitly indexed because PostgreSQL does not index them automatically.

### Modified Capabilities

- None. `openspec/specs/` is currently empty; no existing capability's requirements change.

## Approach

Purely additive schema + migration change, in this order:

1. **Schema.** Add the two `@@index` declarations to `InventoryMovement` in `backend/prisma/schema.prisma`, placed alongside the existing `@@index` block, matching the formatting of the sibling ledger models.
2. **Migration SQL.** Generate the diff with the documented workaround:
   `pnpm exec prisma migrate diff --config prisma/prisma.config.ts --from-config-datasource --to-schema prisma/schema.prisma --script`.
   **Critical**: this diff always emits `DROP INDEX "product_code_trgm_idx"` and `DROP INDEX "product_legacy_code_trgm_idx"` — the two GIN trigram indexes marked "DRIFT ACEPTADO" in `schema.prisma` that exist in the real database on purpose. Those two lines MUST NOT be copied into the migration. Only the two `CREATE INDEX` statements for this change are kept.
3. **Apply.** Write `prisma/migrations/<timestamp>_inventory_movement_indexes/migration.sql` by hand with only those two `CREATE INDEX` statements, then `pnpm exec prisma migrate deploy` and `pnpm exec prisma generate` (both with `--config prisma/prisma.config.ts`). No `migrate:dev`, no `migrate reset`, no `db push --force-reset`.
4. **Verify.** `pnpm test` and `pnpm build` in `backend/`. Optionally confirm the new plans with `EXPLAIN` on the two query shapes.

**Rationale for staying additive**: an added index cannot change query results, only plans; it is reversible with a single `DROP INDEX`. The write cost is negligible here because `inventory_movements` is append-only (inserts only, no updates), so the maintenance burden is one B-tree insert per row with no update churn. Dropping the now-prefix-redundant `@@index([productId])` would be a legitimate follow-up optimization, but it changes the fallback plan for any unreviewed caller and therefore does not belong in a change whose value proposition is "zero behavioral risk".

**Rationale for including gap 2 in the same change**: it touches the same model, the same migration file, and the same verification run. Splitting it would double the migration ceremony for a one-line schema addition. Its standalone value is lower (void is not a hot path), but its marginal cost here is near zero.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` (model `InventoryMovement`, ~line 320-349) | Modified | Two new `@@index` declarations; no field, type, relation, or mapping change |
| `backend/prisma/migrations/<timestamp>_inventory_movement_indexes/migration.sql` | New | Two `CREATE INDEX` statements, nothing else |
| `backend/generated/` (Prisma client) | Modified | Regenerated output; no public type change expected (indexes are not part of the client type surface) |
| `backend/src/documents/documents.service.ts` | Unchanged (beneficiary) | `void()` FK join and cost-reversal lookup get index-backed plans |
| `backend/src/documents/helpers/stock.helpers.ts` | Unchanged (beneficiary) | `resolveLastCostAfterVoidingCm` lookups get index-backed plans |
| `backend/CLAUDE.md` | Modified | Record the FK-indexing convention if not already documented |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The `migrate diff` output includes the two "DRIFT ACEPTADO" `DROP INDEX` lines and they get copied into the migration, silently deleting the production trigram indexes used by product search | Med (it is the documented default behavior of the diff) | Explicitly call it out in the task list; hand-write the migration with only the two `CREATE INDEX` statements; review the final `migration.sql` before `migrate deploy` |
| `CREATE INDEX` (non-concurrent) takes a lock that blocks writes on `inventory_movements` for the duration of the build | Low here / Med in production | The local environment is a test/QA instance with modest volume, so the build is short. **If this migration is ever applied to a live production database, the operator should evaluate `CREATE INDEX CONCURRENTLY` as a separate manual step** — Prisma migrations run inside a transaction, so `CONCURRENTLY` cannot live in a normal migration file |
| Unrelated schema drift already present in the dev database makes the diff noisy beyond the two known trigram indexes | Low | Inspect the full diff output before writing the migration; if anything unexpected appears, stop and report rather than including it |
| Slight write-path overhead on the append-only ledger from two extra B-tree indexes | Low | Accepted: inserts only, no updates; the read-path cost being removed grows without bound while the insert cost is constant |
| Migration is applied but `prisma generate` is skipped, leaving a stale client | Low | Both commands are explicit, ordered steps in the approach and must be verification criteria |

## Rollback Plan

1. **Before the migration is applied**: revert the two `@@index` lines in `backend/prisma/schema.prisma` and delete the unapplied `prisma/migrations/<timestamp>_inventory_movement_indexes/` folder. Nothing else changed.
2. **After the migration is applied**: create a new additive down-migration containing only
   `DROP INDEX IF EXISTS "inventory_movements_document_id_idx";` and
   `DROP INDEX IF EXISTS "inventory_movements_product_id_created_at_idx";`
   (confirm the exact generated names from the applied `migration.sql` — they are Prisma defaults derived from the `@@map`ped table and column names), apply it with `migrate deploy`, then remove the `@@index` lines from the schema and run `prisma generate`. **Never** roll back with `migrate reset` or `db push --force-reset`.
3. Dropping an index is non-destructive to data and restores the exact prior query plans, so rollback carries no data-loss risk.

## Dependencies

- Requires a reachable dev database for `migrate diff` / `migrate deploy` (the workaround in `backend/CLAUDE.md` diffs `--from-config-datasource`, i.e. against the live datasource, not against the migrations folder).
- **Requires explicit user confirmation before implementation.** This change creates a Prisma migration, which is listed under the root `CLAUDE.md` Safety Rules, and `openspec/config.yaml` `rules.proposal` requires flagging it. The migration is strictly additive (`CREATE INDEX` only) and touches no Safety-Rule-protected data, contract, or invariant — but the confirmation gate still applies and must be cleared before `sdd-apply`.
- No new packages, no external services, no frontend impact.

## Success Criteria

- [ ] `backend/prisma/schema.prisma` declares `@@index([documentId])` and `@@index([productId, createdAt])` on `InventoryMovement`, with no other change to the model.
- [ ] The new `migration.sql` contains exactly two `CREATE INDEX` statements and zero `DROP` statements — in particular, neither `product_code_trgm_idx` nor `product_legacy_code_trgm_idx` is dropped.
- [ ] `pnpm exec prisma migrate deploy` and `pnpm exec prisma generate` both complete successfully against the dev database.
- [ ] `cd backend && pnpm test` passes with no new failures relative to the pre-change baseline.
- [ ] `cd backend && pnpm build` succeeds.
- [ ] `EXPLAIN` on the `void()` FK lookup (`WHERE document_id = $1` on `inventory_movements`) shows an index scan instead of a sequential scan. *(Optional evidence — record the result honestly; if the table is small enough that PostgreSQL still prefers a seq scan on current data volume, note that rather than treating it as a failure.)*
- [ ] `BinStock.@@index([warehouseId, productId])` and `Product.@@index([createdAt])` are untouched, and the deferral reason for each is recorded.
- [ ] `backend/CLAUDE.md` documents the FK-indexing convention (FK columns used in relation `include`s get an explicit `@@index`).
