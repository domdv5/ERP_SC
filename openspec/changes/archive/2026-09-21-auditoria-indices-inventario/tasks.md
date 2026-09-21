# Tasks: Inventory Index Audit — Close Missing Index Gaps on `InventoryMovement`

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~10-15 (`schema.prisma` +2, new `migration.sql` ~6-8, `backend/CLAUDE.md` +1 to +3) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (under budget, no chaining needed) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

**Note**: "Decision needed before apply: No" refers only to the chained-PR/delivery-strategy decision above (not applicable — the change is far under the 400-line budget). It does NOT waive the separate, explicit migration-confirmation gate required by the root `CLAUDE.md` Safety Rules — see Task 2.4 below, which blocks `sdd-apply` until the user explicitly confirms the hand-written `migration.sql`.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Add the two `InventoryMovement` indexes end-to-end: schema + hand-written additive migration + doc update + verification | Single PR | `cd backend && pnpm test` | `cd backend && pnpm exec prisma migrate deploy --config prisma/prisma.config.ts` against the reachable dev database, then a catalog query confirming both indexes exist | Pre-apply: revert the two `@@index` lines in `schema.prisma` and delete the unapplied migration folder. Post-apply: hand-written additive down-migration with `DROP INDEX IF EXISTS` for both generated index names, applied via `migrate deploy` — never `migrate reset` / `db push --force-reset` (see proposal Rollback Plan) |

## Phase 1: Schema Change

- [x] 1.1 In `backend/prisma/schema.prisma`, add `@@index([documentId])` and `@@index([productId, createdAt])` to the `InventoryMovement` model (~line 320-349), placed alongside the model's existing `@@index` block, matching the formatting used by sibling ledger models (`EgresoAllocation`, `SupplierCreditApplication`, `ReservationRelease`). Do not modify any field, type, relation, mapping, or the existing standalone `@@index([productId])` — this is a strictly additive, two-line change.

## Phase 2: Migration (Manual Workaround — Safety Rule)

- [x] 2.1 From `backend/`, run `pnpm exec prisma migrate diff --config prisma/prisma.config.ts --from-config-datasource --to-schema prisma/schema.prisma --script` and capture the raw SQL output.
- [x] 2.2 Inspect the raw diff output before writing anything. Confirm it contains exactly the two expected `CREATE INDEX` statements for this change, plus (expected, per `backend/CLAUDE.md`) the two spurious `DROP INDEX "product_code_trgm_idx"` / `DROP INDEX "product_legacy_code_trgm_idx"` lines for the "DRIFT ACEPTADO" trigram indexes. If any other unexpected statement appears (unrelated drift), STOP and report it instead of including it — do not proceed to 2.3.
- [x] 2.3 Hand-write `backend/prisma/migrations/<timestamp>_inventory_movement_indexes/migration.sql` containing **only** the two `CREATE INDEX` statements for `document_id` and `(product_id, created_at)` on `inventory_movements`. Do NOT copy the `DROP INDEX "product_code_trgm_idx"` / `DROP INDEX "product_legacy_code_trgm_idx"` lines, and do not include any other statement from the raw diff.
- [x] 2.4 **GATE — explicit user confirmation required before applying.** Present the final hand-written `migration.sql` content (exact two `CREATE INDEX` statements, zero `DROP` statements) to the user and wait for explicit confirmation to proceed. Do not run Task 2.5 without this confirmation. This gate exists because the change creates a Prisma migration, which is listed under the root `CLAUDE.md` Safety Rules; it is independent of, and in addition to, the Review Workload Forecast decision above. **Confirmed explicitly by the user via the coordinator.**
- [x] 2.5 (Only after Task 2.4 is explicitly confirmed) From `backend/`, run `pnpm exec prisma migrate deploy --config prisma/prisma.config.ts`. Never use `migrate dev`, `migrate reset`, or `db push --force-reset` for this change.
- [x] 2.6 From `backend/`, run `pnpm exec prisma generate --config prisma/prisma.config.ts` to regenerate the Prisma client against the applied schema.

## Phase 3: Documentation

- [x] 3.1 Update `backend/CLAUDE.md` (Database section, near the existing `Document.@@index([sourceDocumentId])` note around line 200) to record, in one line following the project's plain-language comment convention, the general rule: foreign-key columns used in a Prisma relation `include` MUST carry an explicit `@@index`, because Prisma does not auto-index FKs on PostgreSQL. Reuse/reference the existing `Document.sourceDocumentId` precedent rather than duplicating the explanation verbatim; do not add a multi-paragraph block.

## Phase 4: Verification

- [x] 4.1 From `backend/`, run `pnpm test` (Jest) and confirm no new failures relative to the pre-change baseline. **Result**: `pnpm test` exits 1 with "No tests found" — the repo has zero `.spec.ts` files (130 source files checked, 0 matches). This is the pre-existing baseline, unaffected by this change; not a regression.
- [x] 4.2 From `backend/`, run `pnpm build` and confirm it succeeds. **Result**: `nest build` succeeded with no errors.
- [x] 4.3 Confirm both new indexes exist in the database post-migration via a catalog query. **Result**: `pg_indexes` query confirmed `inventory_movements_document_id_idx` and `inventory_movements_product_id_created_at_idx` present, alongside all 5 pre-existing indexes (`_pkey`, `_product_id_idx`, `_warehouse_id_idx`, `_created_at_idx`, `_movement_type_idx`), all unmodified.
- [x] 4.4 (Optional evidence, not a blocking check) Run `EXPLAIN` on the `void()` FK lookup shape. **Result**: at current data volume (174 rows), PostgreSQL still chooses a Seq Scan — expected and acknowledged by the proposal itself as an acceptable outcome at low row counts; the index is present and available as an access path regardless of current planner choice.
- [x] 4.5 Review the final diff of `backend/prisma/schema.prisma` and confirm `BinStock.@@index([warehouseId, productId])`, `Product.@@index([createdAt])`, and the pre-existing standalone `InventoryMovement.@@index([productId])` are all unmodified. **Result**: `git diff` shows only 2 added lines (`@@index([productId, createdAt])`, `@@index([documentId])`) inside `InventoryMovement`; no other line in the file changed.

## Out of Scope (do not add tasks for these)

- `BinStock.@@index([warehouseId, productId])` — deferred pending user confirmation of `scripts/audit-binstock-invariant.mjs` contents (gitignored, unread). See proposal "Out of Scope".
- `Product.@@index([createdAt])` possible redundancy — deferred pending a wider caller sweep. See proposal "Out of Scope".
- Dropping the prefix-redundant standalone `InventoryMovement.@@index([productId])` — separate, evidence-backed decision.
