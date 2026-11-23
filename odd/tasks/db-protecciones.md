# Protecciones de base de datos (una migración)

Tres cambios chicos de schema salidos de la auditoría de BD del 2026-11-23. Rama `chore/db-protecciones` desde `main`. Una sola migración, aplicada con el workaround manual de `backend/CLAUDE.md` (líneas 9-12); nunca `migrate reset` ni `db push --force-reset`.

## Specs

- **S1 — No borrar historia**: `onDelete: Restrict` (hoy `SET NULL`) en estas 5 FKs: `inventory_movements.document_id`, `inventory_movements.document_item_id`, `supplier_credit.source_document_id`, `customer_credit.source_document_id`, `document.source_document_id`. El resto de FKs no se toca.
- **S2 — Borrar borradores sigue funcionando**: `documents.service.ts:466-467` borra los ítems y el documento de un borrador. Tras migrar, borrar un borrador (con y sin documento de origen) tiene que seguir funcionando en la base local, y borrar un documento confirmado con kardex directo en SQL tiene que fallar.
- **S3 — Índice del kardex**: agregar `@@index([documentItemId])` en `InventoryMovement` y quitar `@@index([productId])` (cubierto por `@@index([productId, createdAt])`).
- **S4 — Estado de saldos a favor como enum**: `SupplierCredit.status` y `CustomerCredit.status` (hoy `String @db.VarChar(10)`, valores `available|used` y `available|used|voided`) pasan a un enum Prisma con `available`, `used`, `voided`. Antes de migrar, comprobar con un SELECT que la base local no tiene otros valores. La migración debe conservar los datos (`ALTER COLUMN ... TYPE ... USING status::"<Enum>"`) y quitar y volver a crear cualquier CHECK que mencione `status` (ej. el de `customer_credit` con `'voided'`). Ajustar el código que use esos strings solo si `tsc` lo exige.
- **S5 — Revisar el SQL generado**: el `migrate diff` puede traer `DROP` de CHECKs/índices hechos a mano; quitar del `migration.sql` todo lo que no sea S1, S3 o S4.
- **S6 — Verificación**: `prisma migrate deploy` en local OK, `prisma generate`, `jest` completo, `tsc --noEmit -p tsconfig.json`. Actualizar `backend/CLAUDE.md` con una línea por decisión no obvia (Restrict y por qué; enum de estado).

## Tasks

- T1 — S1-S6 — prisma-db-architect — commit: ver PR (migración 20261123120000_db_protecciones; 733 tests, tsc ok)
- T2 — verificación independiente — gentle-ai-verify — S1-S6 cumplidos, sin bloqueantes

## Log

- L1 — Dueño, sobre el plan "Paso 2: una sola migración con los puntos 3, 4 y 6": "dale"
- L2 — Dueño confirmó el motivo de S1: "el terceero es por ai alguein borra desde la bd sin pasar por el aplciativo cierot?" (sí, más scripts y código futuro).
- L3 — Writer: el `migrate diff` hacía DROP/ADD de `status` (perdía los estados); se reemplazó por `ALTER COLUMN ... TYPE ... USING`. Conteos por estado idénticos antes/después.
- L4 — Verify: S1-S6 cumplidos. Un borrador nunca es origen de nada (conversión y CMO exigen origen confirmado; créditos nacen en confirm). Seguimiento no bloqueante: carrera borrar-borrador vs confirmar en `documents.service.ts` remove() ahora daría 400 "Referencia a un registro que no existe" (antes dejaba kardex huérfano).
