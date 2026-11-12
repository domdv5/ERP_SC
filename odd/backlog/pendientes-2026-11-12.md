# Pendientes al cierre del 2026-11-12

Estado de `main`: `aa232c5` (PR #98 POS con crédito, PR #99 seguimiento, PR #100 columnas de cupo en Terceros).

## Salieron de hoy
1. **El cupo total les llega a todos los roles** (venía de antes). `GET /third-parties` y `/third-parties/:id` incluyen `customer.creditLimit` para cualquiera con `thirdparty.read`; Bodega, Compras y Preventa lo reciben aunque no lo vean en pantalla. Regla acordada: los demás roles no reciben el dato. PR chico de backend.
2. **Campos de monto que vuelven al valor anterior al borrar.** Mismo bug que tenía el límite de crédito (`Controller` + `ThousandsInput` con `onChange={field.onChange}`). Revisar y confirmar en: `products/components/ProductForm.tsx:366, :382`, `egresos/EgresoNewPage.tsx:477`, `recibos-caja/RecibosCajaNewPage.tsx:563, :681`, `documents/components/POSCartLine.tsx:119`, `documents/components/ProductRow.tsx:264, :298`. Arreglo de referencia: `ThirdPartyForm.tsx` (`field.onChange(v ?? null)`).
3. **Usuarios de prueba en la base local**: `cupo_bodega` (warehouse) y `cupo_cartera` (accounts_admin), clave `CupoPrueba2026!`. Borrarlos o desactivarlos.
4. **Excedentes no refrescan la lista de Terceros**: `RegisterExcedenteModal.tsx` y la anulación en `AccountsReceivableClientStatementPage.tsx:93` no invalidan `third-parties`. Confirmar si un excedente cambia la deuda; si sí, usar `invalidateThirdParties`.

## Seguían de antes
5. Un borrador de POSO puede guardar una línea "Crédito" (solo se rechaza al confirmar). Bajo.
6. Enlace "Convertido por → venta derivada" en el detalle de PV y REM.
7. Revisar REMs guardadas con precio 0 antes del arreglo del pistoleo.
8. Quitar `Customer.discount` (migración).
9. Pruebas de pantallas A5 y e2e.
10. Mover el JWT a cookie HttpOnly.
11. Lint (8 avisos en backend; el frontend no tiene ESLint).
12. Recibo de caja: descuento y excedentes (esperando a la empresa).
13. Rama remota vieja `feat/scan-separate-rows` en GitHub: borrar si se aprueba.

## Decisiones de negocio pendientes
- Conversión de preventa a facturación.
- Saldos a favor al retomar un borrador.
- Reglas CHECK por tipo de documento.

## Producción (detalle en `PENDIENTES-PRODUCCION.md`, local)
Scripts de importación, ruta `/health`, `pg_dump` diario a Backblaze y prueba de restauración, logs fuera del servidor, evaluar NestJS Observe, `.env` de producción y cambio de la clave de admin.
