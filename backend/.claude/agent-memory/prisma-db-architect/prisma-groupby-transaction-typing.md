---
name: prisma-groupby-transaction-typing
description: Prisma 7 groupBy loses type inference inside $transaction([...]) arrays — declare queries as variables first; orderBy is also required by the conditional type
metadata:
  type: project
---

`product.groupBy()` (Prisma 7.8) breaks TypeScript inference when written inline inside a `$transaction([...])` batch array: the result degrades to the wide `ProductGroupByOutputType` (`_count: true | {...} | undefined`) and the args type starts demanding `orderBy`.

**Why:** the generic inference of `groupBy` happens at its call site; inside the array context TS widens the literal args, so `_count: { _all: true }` no longer narrows the output. Hit this on 2026-06-12 refactoring `ProductsService.findAll`.

**How to apply:** when batching a `groupBy` with other queries, (1) always pass an explicit `orderBy` (e.g. `orderBy: { active: 'asc' }`), and (2) assign each query to a `const` (`const countsQuery = this.prisma.product.groupBy({...})`) and pass the variables to `$transaction([...])` — the tuple unwrap then preserves precise types. Pattern in use: list-page stats fold `count(total)` + `count(active)` into one `groupBy(['active'])` (total = sum of groups), leveraging the existing `@@index([active])`; counts that depend on relations (e.g. `inStockCount` via `inventoryRecords.some.quantity > 0`) still need their own `count`.
