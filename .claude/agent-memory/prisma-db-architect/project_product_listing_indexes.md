---
name: product-listing-indexes
description: Product list indexes end in createdAt because every GET /products query filters `active` and sorts createdAt desc; pg_trgm deferred deliberately
metadata:
  type: project
---

`GET /products` indexes were reshaped (migration `20260812100000_product_listing_indexes`) so every composite on `Product` ends in `createdAt`: `[active, createdAt]`, `[active, brandId, createdAt]`, `[active, categoryId, createdAt]`, `[active, genderId, createdAt]`. The strict-prefix predecessors (`[active]`, `[active, brandId]`, `[active, categoryId]`, `[active, genderId]`) were dropped in the same migration. Also added `DocumentItem @@index([documentId])` — Prisma does not auto-index FKs on PostgreSQL.

**Why:** `ProductsService.findAll` always puts `active` in the `where` (`active !== undefined ? active : true` — never absent) and always sorts `orderBy: { createdAt: 'desc' }` with `skip`/`take`. Without `createdAt` as the trailing index column the planner had to materialize and sort every row matching the filter before paginating — invisible at today's volume, quadratic pain at the "muchísimos productos" the user is planning for.

**Deliberately NOT done (deferred until volume justifies it):**
- `pg_trgm` + GIN on `product.code` / `product.legacy_code`. The search filter is `contains` + `mode: 'insensitive'` → `ILIKE '%term%'`, whose leading wildcard makes every btree (including `code`'s `@unique`) useless. This is the single biggest known future bottleneck of that endpoint. Blocked on volume, not on design.
- Cursor-based pagination to replace `OFFSET`.
- The three `count()` calls in the same `$transaction` (total / activeCount / inStockCount) each scan the whole filtered set, and `inStockCount` adds an `Inventory` semi-join — they scale with total product count, not page size.

**How to apply:** when adding a new filter to the products list, extend the pattern (`active` first, new filter column, `createdAt` last) rather than adding a bare single-column index. Do not add partial indexes (`WHERE active = true`) via raw SQL — Prisma can't express them declaratively and `migrate diff` would try to drop them, reintroducing drift.
