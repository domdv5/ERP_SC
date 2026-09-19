---
name: schema-indexes-audit-v1
description: Índices agregados al schema en la auditoría inicial de ThirdParty, Product, Brand, Gender, Category
metadata:
  type: project
---

# Auditoría de índices — junio 2026

Primera auditoría de índices sobre los modelos ya implementados.

**Why:** Los módulos ThirdParties y Products usan búsqueda paginada server-side con múltiples filtros booleanos y FK. PostgreSQL no crea índices automáticos sobre FK ni booleans.

**How to apply:** Al agregar nuevos módulos, repetir el mismo patrón: indexar FK sin índice explícito, campos booleanos de filtro frecuente, y `createdAt` cuando se usa en `orderBy`.

## Índices agregados

### ThirdParty (`third_parties`)
- `@@index([isActive])` — filtro `isActive: true` en TODOS los `findMany`
- `@@index([isCustomer])` — filtro opcional `isCustomer` en el listado
- `@@index([isSupplier])` — filtro opcional `isSupplier` en el listado
- `@@index([createdAt])` — `orderBy: { createdAt: 'desc' }` en la paginación

### Product (`product`)
- `@@index([active])` — filtro `active` en el listado paginado
- `@@index([brandId])` — FK sin índice, filtro frecuente por marca
- `@@index([genderId])` — FK sin índice, filtro frecuente por género
- `@@index([categoryId])` — FK sin índice, filtro frecuente por categoría
- `@@index([createdAt])` — `orderBy: { createdAt: 'desc' }` en la paginación
- `@@index([active, brandId])` — índice compuesto para `WHERE active = true AND brand_id = ?`
- `@@index([active, categoryId])` — índice compuesto para `WHERE active = true AND category_id = ?`
- `@@index([active, genderId])` — índice compuesto para `WHERE active = true AND gender_id = ?`

### Brand (`brand`)
- `@@index([active])` — `getBrands()` filtra `active: true`
- `@@index([supplierId])` — FK sin índice explícito, join frecuente desde Product

### Gender (`gender`)
- `@@index([active])` — `getGenders()` filtra `active: true`

### Category (`category`)
- `@@index([active])` — `getCategories()` filtra `active: true`

## Decisiones NOT aplicadas

- No se indexó `name` en ThirdParty ni `description`/`code` en Product para búsqueda `ILIKE`: los índices B-tree no aceleran `LIKE '%text%'` (el wildcard a la izquierda impide el uso del índice). Si en el futuro se necesita full-text search, se recomienda `pg_trgm` con índice GIN.
- No se tocaron modelos no implementados (Warehouse, Document, Inventory, etc.)

## Migración — APLICADA (verificado 2026-08-11)
Los índices de `third_parties` ya existen en la DB real (`pg_indexes` confirma
`is_active`, `is_customer`, `is_supplier`, `is_seller`, `created_at`).
La nota anterior de "migración pendiente" quedó obsoleta.

Ver [[thirdparty-findall-explain-analyze]] para la medición real de estos índices:
la mayoría **no se usan hoy** (tabla de 1 página) y a escala el que realmente
sostiene el listado es `created_at`, no los booleanos.
