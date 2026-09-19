---
name: thirdparty-findall-explain-analyze
description: Medición EXPLAIN ANALYZE real de ThirdParty.findAll — hoy Seq Scan (29 filas), y a escala el cuello de botella son los 3 count(), no el findMany
metadata:
  type: project
---

# Diagnóstico medido de `third-parties.service.ts::findAll()` (2026-08-11)

Medido con `EXPLAIN ANALYZE` contra la DB real (PostgreSQL 16.11) + proyección a
200k filas con tabla temporal. No es teoría.

## Estado hoy
`third_parties` = **29 filas, 8 KB (una sola página de heap)**. Las 3 variantes
(`is_active`, `is_active+ILIKE`, `is_active+is_customer`) hacen **Seq Scan**, y es
lo correcto: ningún índice le gana a leer una página. `Planning Time` (1.47 ms)
supera al `Execution Time` (0.16 ms).

`pg_stat_user_indexes` muestra `idx_scan = 0` en **todos** los índices, incluido
el PK — a este tamaño Postgres ni siquiera usa el pkey.

**Why:** Es la referencia para no volver a "optimizar" esta tabla por intuición.
**How to apply:** Si alguien reporta lentitud en el listado de terceros, el problema
NO es de índices hasta que la tabla crezca ~3 órdenes de magnitud.

## Confirmado: `contains` + `mode: 'insensitive'` no usa B-tree
Prisma emite `name ~~* '%term%'`. En el plan aparece como `Filter:`, nunca como
`Index Cond:`. El comodín inicial impide cualquier B-tree. Confirmado a 29 y a
200k filas. (Ya estaba anotado en [[schema-indexes-audit-v1]]; ahora está medido.)

## Hallazgo a escala (200k): el problema son los `count()`, no el `findMany`
- `findMany` con `LIMIT 20 ORDER BY created_at DESC` → **Index Scan Backward** sobre
  `created_at_idx`, 0.04 ms. Los índices booleanos no se usan y no hacen falta.
- `count()` con `is_active=true` → **Seq Scan 21 ms** (99% de filas pasan el filtro;
  selectividad nula, el índice booleano es inútil ahí).
- `count()` con `is_active AND is_customer` → Bitmap Index Scan, 10 ms.
- **Caso patológico**: búsqueda sin resultados → `findMany` **94 ms** (recorre el
  índice `created_at` entero descartando 200k filas) + los counts en Seq Scan ~91 ms
  c/u. Como `findAll` corre 1 findMany + **3 counts** en un `$transaction`
  secuencial, eso son ~370 ms para una búsqueda que no encuentra nada.

**How to apply:** cuando esta tabla escale, atacar primero los 3 `count()`
(cachearlos, o derivar `customerCount`/`supplierCount` de otra forma) antes de tocar
índices. Es un cambio de servicio, no de schema.

## Índice `is_active` — sí se justifica, por la vista "Inactivos"
Con `is_active=true` (~80-99% de filas) nunca se usa. Con `is_active=false`
(~21% real de ustedes) a escala sí: Bitmap Index Scan, 7.6 ms vs Seq Scan.
La vista "Inactivos" del frontend es lo que lo justifica.

## Decisión: pg_trgm NO, todavía
`pg_trgm` está disponible en el servidor pero **no instalado**. No se recomendó:
a 29 filas (y a unos pocos miles) es optimización prematura pura.

**Umbral para reconsiderar:** ~20.000+ terceros, o cuando el listado con búsqueda
pase de ~200 ms medidos. Para un ERP de una sola empresa, `third_parties`
(clientes+proveedores+vendedores) difícilmente llega ahí.
