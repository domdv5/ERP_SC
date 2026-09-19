# Memory Index

- [Prisma groupBy + $transaction typing](prisma-groupby-transaction-typing.md) — groupBy inside batch arrays loses inference; declare query vars first, orderBy required
- [Product trigram index drift](product-trgm-index-drift.md) — GIN pg_trgm indexes exist in DB but not schema; strip their DROP INDEX from any migrate diff output
- [varchar→enum migration trap](varchar-to-enum-migration-trap.md) — migrate diff DROPs the column (data loss), PG enum types are PascalCase-quoted, plus one accounts_payable row whose status already drifted
