---
name: credit-tables-stay-separate
description: CustomerCredit/SupplierCredit stay as separate tables (not unified); CustomerCredit is currently a dead model awaiting Phase 2 sales docs
metadata:
  type: project
---

`CustomerCredit` and `SupplierCredit` are deliberately kept as two separate tables rather than unified into a generic polymorphic credit table.

**Why:** The FKs are the deciding factor. `customer_credit.third_party_id → customers.id` and `supplier_credit.supplier_id → suppliers.id` are real, DB-enforced constraints. Unifying forces either a polymorphic `partyId → third_parties.id` + discriminator (PostgreSQL cannot enforce that the target actually has a `customers`/`suppliers` row) or two nullable FKs + a CHECK — which keeps both FKs and only merges row storage. The asymmetry is irreducible one level down: `SupplierCreditApplication.accountPayableId → accounts_payable.id`, and any customer equivalent must point at `accounts_receivable.id`. Same precedent as the already-documented AP/AR separation in CLAUDE.md.

**Also relevant:** `CustomerCredit` has zero references in `backend/src/` or `frontend/src/` — it is a dead model from the `20260521195854_init` migration. It stays dormant until Phase 2 sales document types (`COT`/`POS`/`DVV`) exist, since those are what would generate customer credit. `SupplierCredit` is live (created by `dvc-effect.strategy.ts`, consumed by `accounts-payable.service.ts`).

**How to apply:** When customer credit is actually built, mirror the supplier design rather than unifying — add `CustomerCreditApplication` (FK to `accounts_receivable`), `@@index([customerId, status])`, and a `@default("available")` on status. Do not propose a generic `Credit` table. See [[migration-history-divergence]] for the migration workflow caveat.
