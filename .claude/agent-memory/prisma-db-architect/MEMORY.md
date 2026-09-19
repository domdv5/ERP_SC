# Memory Index

- [Brand reconciliation decision](project_brand_reconciliation.md) — Supplier brands: diff + soft-delete via existing `active`; never deleteMany+createMany (P2003); @@unique pending
- [Migration history divergence](project_migration_history_divergence.md) — benign DB-only row (zone/bin rename) persists, but Prisma 7.8.0 `migrate status` no longer warns; don't STOP on it
- [ThirdParty tax profile](project_third_party_tax_profile.md) — tax fields are informational-only; `ivaResponsible` is tri-state on purpose — never add `@default(false)`
- [Credit tables stay separate](project_credit_tables_stay_separate.md) — CustomerCredit/SupplierCredit never unified (FK integrity); CustomerCredit is dead code until Phase 2 sales docs
- [Preventa reservations are derived](project_preventa_derived_reservation.md) — PV reserva se calcula de items PV confirmados; nunca persistir un total agregado (evita 2do invariante)
- [Product listing indexes](project_product_listing_indexes.md) — composites on Product end in `createdAt` (filter+sort+paginate); pg_trgm/GIN for ILIKE search deferred on purpose
