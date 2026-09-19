# Memory Index

- [Schema Indexes Audit v1](schema_indexes_audit.md) — Índices de ThirdParty, Product, Brand, Gender, Category. Migración YA aplicada (verificado 2026-08-11).
- [ThirdParty.findAll — EXPLAIN ANALYZE real](perf_thirdparty_findall_explain.md) — Hoy Seq Scan (29 filas, 1 página); a escala el cuello son los 3 count(), no el findMany. pg_trgm descartado hasta ~20k filas.
