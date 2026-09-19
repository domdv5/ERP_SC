---
name: project_documents_strategies_duck_typed_helpers
description: Document effect strategies validate the same business rule twice (validateCreate pre-transaction vs confirm in-transaction) against two structurally-similar-but-differently-typed inputs; shared private helpers use duck-typed param shapes instead of casts.
metadata:
  type: project
---

Each `XxxEffectStrategy` in `backend/src/documents/strategies/` typically implements the same validation twice:
- `validateCreate(createDocumentDto)` — runs pre-transaction, against `CreateDocumentDto`/`CreateDocumentItemDto[]` (raw client input, `this.prisma`).
- `confirm(tx, document, userId)` — runs inside the write transaction, against `DocumentWithItems`/`DocumentWithItems['documentItems']` (DB-loaded, `tx: Prisma.TransactionClient`).

Because a draft can be edited via `PATCH` without re-running `validateCreate`, `confirm()` must independently re-validate — it can't assume `validateCreate`'s checks still hold (see the existing inline comment in `transfer-effect.strategy.ts::confirm`: "Se revalida bin/bodega acá, no solo en validateCreate...").

To share validation logic between the two call sites without duplicating it or casting types, private helper methods take **minimal duck-typed structural params** (e.g. `items: { productId: string }[]`) rather than the full DTO or Prisma type — this lets one method satisfy both `CreateDocumentItemDto[]` and `DocumentWithItems['documentItems']` naturally. Same pattern already existed for `PrismaOrTx = PrismaService | Prisma.TransactionClient` (see file header comment referencing `documents/helpers/reservation.helpers.ts`) to let bin-validation helpers run both outside a transaction (`this.prisma`) and inside one (`tx`).

**How to apply**: when adding a new cross-cutting validation to a document strategy that must run in both `validateCreate` and `confirm`, default to a duck-typed private helper (narrowest structural shape needed) instead of importing/casting the full DTO or Prisma-generated type into the other context.
