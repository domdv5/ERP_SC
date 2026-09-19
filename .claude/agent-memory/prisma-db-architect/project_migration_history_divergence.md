---
name: migration-history-divergence
description: A DB-only migration row (zone/bin rename) still exists in _prisma_migrations, but Prisma 7.8.0's `migrate status` no longer warns about it — harmless either way
metadata:
  type: project
---

The dev DB (`erp_db` @ localhost:5432) has a **benign, pre-existing divergence** in `_prisma_migrations`: a migration row with no matching local folder. It is not caused by any current change, and it does not affect `migrate deploy`.

**Why:** During June 2026 dev, migration folder `20260624191727_alter_zone_name_field` was renamed to `20260624191727_alter_bin_name_field` (same timestamp). Verified still true 2026-08-11 — the DB holds `alter_zone_name_field` (applied, finished) while only the `alter_bin_name_field` folder exists on disk. There is also a `rolled_back=true` row for `alter_bin_name_field` paired with a successful re-applied row, so history is in a *resolved* state, not a *failed* one.

**How to apply:** Do NOT treat this as a STOP condition. Note the behavior change: this memory previously recorded that `migrate status` **exits 1 with a divergence warning** — as of Prisma **7.8.0** (verified 2026-08-11) it instead reports "Database schema is up to date!" and exits 0, saying nothing about the orphan row. So a clean `migrate status` is now expected, and is *not* evidence the divergence was repaired. `migrate deploy` only applies local folders absent from `_prisma_migrations` by exact name, so the DB-only row never causes it to act. To inspect the real state, query `_prisma_migrations` directly (the `mcp__dbhub__execute_sql` tool reaches this DB without needing credentials). The manual migration workflow itself is in CLAUDE.md — this memory only covers the divergence gotcha. See [[third-party-tax-profile]] for a migration that applied cleanly over this divergence.
