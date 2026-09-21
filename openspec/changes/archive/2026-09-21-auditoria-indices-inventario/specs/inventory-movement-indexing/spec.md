# Inventory Movement Indexing Specification

## Purpose

Defines the data-access performance contract for the `InventoryMovement` ledger table: which access paths (FK joins originating from `Document`, product-scoped cost-reversal lookups) MUST be index-backed, and the schema-wide convention that any foreign-key column participating in a Prisma relation `include` MUST carry an explicit `@@index`, because Prisma does not auto-index foreign keys on PostgreSQL.

This capability is purely a data-access/performance contract. It does not change stock quantities, document lifecycle behavior, or any query result — only the query plan PostgreSQL selects to produce that result.

## Requirements

### Requirement: `InventoryMovement.documentId` MUST be indexed

The `InventoryMovement` model MUST declare `@@index([documentId])` in `backend/prisma/schema.prisma`, matching the FK-indexing convention already applied to sibling ledger models (`EgresoAllocation`, `SupplierCreditApplication`, `ReservationRelease`).

#### Scenario: Document void looks up inventory movements by document

- GIVEN a confirmed document with one or more associated `InventoryMovement` rows
- WHEN `documents.service.ts::void()` executes `document.findUnique({ include: { inventoryMovements: {...} } })`, which Prisma translates into a filter on `document_id`
- THEN PostgreSQL MUST have an index available on `inventory_movements.document_id` to serve that filter
- AND the query result set (the movements returned) MUST be identical to the result produced without the index

#### Scenario: Index exists independent of table size

- GIVEN the `inventory_movements` table at any row count, including zero rows
- WHEN the schema is inspected via `\d inventory_movements` or an equivalent catalog query
- THEN an index covering `document_id` MUST be present
- AND the presence of the index MUST NOT be conditional on data volume, feature flags, or environment

### Requirement: `InventoryMovement` MUST have a composite index on `(productId, createdAt)`

The `InventoryMovement` model MUST declare `@@index([productId, createdAt])` in `backend/prisma/schema.prisma`, in addition to (not replacing) the existing standalone `@@index([productId])`.

#### Scenario: Cost-reversal lookup filters by product and orders/filters by creation time

- GIVEN `stock.helpers.ts::resolveLastCostAfterVoidingCm` or `documents.service.ts::void()` execute a `findFirst` filtering on `productId` and filtering/sorting on `createdAt`
- WHEN the query runs against `inventory_movements`
- THEN PostgreSQL MUST have a composite index covering `(product_id, created_at)` available as an access path
- AND the row returned by the lookup MUST be identical to the row returned without the composite index

#### Scenario: Composite index does not replace the existing standalone index

- GIVEN the schema change described in this capability
- WHEN `backend/prisma/schema.prisma` is inspected after the change
- THEN the pre-existing standalone `@@index([productId])` on `InventoryMovement` MUST still be present, unmodified
- AND the composite `@@index([productId, createdAt])` MUST be an addition alongside it, not a replacement

### Requirement: The migration MUST be strictly additive

The generated Prisma migration for this change MUST contain only `CREATE INDEX` statements for the two new indexes and MUST NOT contain any `DROP INDEX`, `DROP TABLE`, `ALTER COLUMN`, or any other destructive or structural statement.

#### Scenario: Migration contains exactly two CREATE INDEX statements

- GIVEN the migration file `prisma/migrations/<timestamp>_inventory_movement_indexes/migration.sql`
- WHEN its contents are inspected
- THEN it MUST contain exactly two SQL statements, both `CREATE INDEX`
- AND it MUST contain zero `DROP` statements of any kind

#### Scenario: Accepted schema drift is never dropped (negative scenario)

- GIVEN `pnpm exec prisma migrate diff --config prisma/prisma.config.ts --from-config-datasource --to-schema prisma/schema.prisma --script` is run to draft this migration
- WHEN the raw diff output is produced
- THEN the diff MAY spuriously include `DROP INDEX "product_code_trgm_idx"` and `DROP INDEX "product_legacy_code_trgm_idx"` — these are documented "DRIFT ACEPTADO" GIN trigram indexes that exist in the real database on purpose and are intentionally absent from `schema.prisma`
- AND the final, hand-written `migration.sql` that is committed and deployed MUST NOT contain either of those two `DROP INDEX` statements
- AND applying the committed migration MUST leave both `product_code_trgm_idx` and `product_legacy_code_trgm_idx` present and unmodified in the database

### Requirement: The `BinStock`/`Inventory` stock invariant MUST remain intact

This change MUST NOT modify any code path that writes to `BinStock` or `Inventory`. The invariant `SUM(BinStock.quantity WHERE warehouseId=W) === Inventory.quantity WHERE warehouseId=W` MUST hold after this change exactly as it did before.

#### Scenario: Stock write paths are untouched

- GIVEN the stock-mutation functions `applyStockChange` and `applyBinStockChange`
- WHEN this change's diff is inspected
- THEN neither function's implementation, call sites, nor the raw SQL they execute MUST appear in the diff
- AND no new write path to `BinStock` or `Inventory` MUST be introduced

#### Scenario: Invariant holds after migration is applied

- GIVEN the invariant held for warehouse `W` before this migration was applied
- WHEN the migration (`CREATE INDEX` only) is applied and the application continues normal operation
- THEN `SUM(BinStock.quantity WHERE warehouseId=W)` MUST still equal `Inventory.quantity WHERE warehouseId=W` for every warehouse `W`
- AND no stock quantity MUST change as a side effect of adding an index

### Requirement: Indexes outside this change's scope MUST remain untouched

The following indexes MUST NOT be added, removed, or modified by this change, and each deferral MUST be recorded with its reason:

- `BinStock.@@index([warehouseId, productId])`
- `Product.@@index([createdAt])`
- The existing standalone `InventoryMovement.@@index([productId])`

#### Scenario: BinStock composite index is deferred, not removed

- GIVEN `BinStock.@@index([warehouseId, productId])` exists prior to this change
- WHEN `backend/prisma/schema.prisma` is inspected after this change
- THEN the index MUST still be declared, unmodified
- AND the deferral reason (unread gitignored `scripts/audit-binstock-invariant.mjs` may depend on it; requires explicit user confirmation before any removal) MUST be recorded in the change's proposal or design documentation

#### Scenario: Product.createdAt index is deferred, not removed (negative scenario)

- GIVEN `Product.@@index([createdAt])` exists prior to this change, alongside `[active, createdAt]` and other `[active, X, createdAt]` composite indexes
- WHEN `backend/prisma/schema.prisma` is inspected after this change
- THEN `Product.@@index([createdAt])` MUST still be declared, unmodified
- AND the deferral reason (possible redundancy not yet confirmed across all callers, pending a wider caller sweep) MUST be recorded in the change's proposal or design documentation

#### Scenario: Standalone productId index is preserved despite prefix redundancy

- GIVEN the new `@@index([productId, createdAt])` composite index makes the standalone `@@index([productId])` a prefix-redundant candidate
- WHEN `backend/prisma/schema.prisma` is inspected after this change
- THEN the standalone `@@index([productId])` MUST still be declared, unmodified
- AND its potential removal MUST remain a separate, evidence-backed decision outside this change

### Requirement: The FK-indexing convention MUST be documented

`backend/CLAUDE.md` MUST record the convention that foreign-key columns used in a Prisma relation `include` MUST carry an explicit `@@index`, because Prisma does not automatically index foreign keys on PostgreSQL.

#### Scenario: Convention is discoverable in backend/CLAUDE.md

- GIVEN a future contributor adds a new Prisma model with a foreign key that will be used in an `include`
- WHEN they read `backend/CLAUDE.md`
- THEN they MUST find a statement documenting that FK columns used in relation `include`s require an explicit `@@index`, since Prisma does not auto-index FKs on PostgreSQL
- AND the statement MUST follow the project's one-line, plain-language comment/documentation convention (no multi-paragraph explanation block)

#### Scenario: Convention is not duplicated if already present

- GIVEN `backend/CLAUDE.md` already documents this convention under an existing section
- WHEN this change is applied
- THEN the existing statement MUST be reused or referenced rather than duplicated verbatim elsewhere in the file
