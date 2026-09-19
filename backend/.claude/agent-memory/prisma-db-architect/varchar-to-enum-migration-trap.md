---
name: varchar-to-enum-migration-trap
description: Converting a String column to a Prisma enum — migrate diff emits DROP COLUMN+ADD COLUMN (silent data loss), PG enum type names are PascalCase-quoted, and accounts_payable has one row whose status already drifted from its payments
metadata:
  type: project
---

Two facts that bite every time a `String @db.VarChar` status column in this schema is promoted to a Prisma enum (AP/AR `status`, `SupplierCredit.status`, `CustomerCredit.status` are all still strings as of 2026-09-18).

**1. `prisma migrate diff` destroys the data.** For a String→Enum column change it emits
`ALTER TABLE x DROP COLUMN "status", ADD COLUMN "status" "T" NOT NULL DEFAULT '...'` — every existing value is lost. The generated SQL must be replaced by hand with:
```sql
CREATE TYPE "AccountsPayableStatus" AS ENUM ('pending','partial','paid');
ALTER TABLE "accounts_payable" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "accounts_payable" ALTER COLUMN "status" TYPE "AccountsPayableStatus" USING "status"::"AccountsPayableStatus";
ALTER TABLE "accounts_payable" ALTER COLUMN "status" SET DEFAULT 'pending';
```
The `DROP DEFAULT` step is mandatory — without it PG refuses ("default cannot be cast automatically"). And the conversion **does** rewrite the table under ACCESS EXCLUSIVE (varchar and enum are not binary-coercible), it is not a metadata-only change.

**2. PG enum type names here are PascalCase and case-sensitive.** No enum in `schema.prisma` uses `@@map`, so Prisma creates `"DvvRefundMethod"`, `"PaymentMethod"`, `"DocumentType"` — verified in `pg_type`. A cast written as `::accounts_payable_status` fails with "type does not exist"; it must be `::"AccountsPayableStatus"`.

**Data drift to fix before any CHECK ties status to amounts:** `accounts_payable` row `612c5d33-c0c2-429c-9190-2775cd5c2cf8` (CM 000001, total 12.000) has a 5.000 `payable_payments` row from 2026-07-06 but `status = 'pending'` — it should be `partial`. Predates or bypassed `registerPayment`'s status recompute. Any migration that backfills a `paid_amount` cache or adds a status/amount consistency CHECK must repair this row first or it fails mid-migration.

Related: [[product-trgm-index-drift]]
