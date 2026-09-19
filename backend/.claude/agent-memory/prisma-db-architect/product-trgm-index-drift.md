---
name: product-trgm-index-drift
description: Product has two GIN pg_trgm indexes that exist in Postgres but not in schema.prisma — migrate diff will try to DROP them and those DROPs must be deleted by hand
metadata:
  type: project
---

`product_code_trgm_idx` and `product_legacy_code_trgm_idx` (GIN + `gin_trgm_ops` on `code` / `legacy_code`, plus `CREATE EXTENSION pg_trgm`) live in migration `20260812140000_product_trigram_search`. They are **intentionally absent** from `schema.prisma` — Prisma cannot declare extensions or operator classes.

**Why:** `ProductsService.findAll` searches with `contains` + `mode: 'insensitive'`, which Prisma emits as `ILIKE '%term%'`. The leading wildcard makes every btree unusable — including the `@unique` on `code` — so Postgres was forced into a Seq Scan. `findByCode`/`findLocationsByCode` use `equals` + `insensitive` (`ILIKE 'term'` with no wildcards) and were *also* unable to use the unique btree, for case-insensitivity; the trigram index serves those too.

**How to apply:** Any hand-written migration generated via `prisma migrate diff --from-config-datasource --to-schema` will include `DROP INDEX "product_code_trgm_idx"` and `DROP INDEX "product_legacy_code_trgm_idx"`. **Delete those two statements from the generated script before saving the migration** — otherwise product search silently regresses to Seq Scan with no error anywhere. This is accepted, permanent drift, documented in a comment on the `Product` model.

Measured on 60k synthetic rows (inserted then rolled back): Seq Scan 25.7 ms → BitmapOr over both GIN indexes 1.16 ms (~22x). Caveat inherent to trigrams: search terms under 3 characters cannot use the index and still Seq Scan — expected, not a bug.

Related: [[prisma-groupby-transaction-typing]]
