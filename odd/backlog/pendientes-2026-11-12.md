# Pendientes al cierre del 2026-11-12

Estado de `main`: `aa232c5` (PR #98 POS con crédito, PR #99 seguimiento, PR #100 columnas de cupo en Terceros).

## Salieron de hoy
1. **El cupo total les llega a todos los roles** (venía de antes). `GET /third-parties` y `/third-parties/:id` incluyen `customer.creditLimit` para cualquiera con `thirdparty.read`; Bodega, Compras y Preventa lo reciben aunque no lo vean en pantalla. Regla acordada: los demás roles no reciben el dato. PR chico de backend. **Descartado (2026-11-13)**: el dueño decidió que no es un problema que el dato viaje; PR #101 cerrado sin mergear.
2. **Campos de monto que vuelven al valor anterior al borrar.** Mismo bug que tenía el límite de crédito (`Controller` + `ThousandsInput` con `onChange={field.onChange}`). Revisar y confirmar en: `products/components/ProductForm.tsx:366, :382`, `egresos/EgresoNewPage.tsx:477`, `recibos-caja/RecibosCajaNewPage.tsx:563, :681`, `documents/components/POSCartLine.tsx:119`, `documents/components/ProductRow.tsx:264, :298`. Arreglo de referencia: `ThirdPartyForm.tsx` (`field.onChange(v ?? null)`).
3. **Usuarios de prueba en la base local**: `cupo_bodega` (warehouse) y `cupo_cartera` (accounts_admin), clave `CupoPrueba2026!`. Borrarlos o desactivarlos.
4. **Excedentes no refrescan la lista de Terceros**: `RegisterExcedenteModal.tsx` y la anulación en `AccountsReceivableClientStatementPage.tsx:93` no invalidan `third-parties`. Confirmar si un excedente cambia la deuda; si sí, usar `invalidateThirdParties`. **Cerrado sin código (2026-11-13)**: registrar o anular un excedente solo escribe `customer_credit`, no toca CxC, así que no cambia el "Usado" del cupo.

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
14. Revisar las pruebas existentes (backend y frontend) y quitar las de bajo valor (textos, columnas, layout) según el hábito 7 del `CLAUDE.md` raíz. Sin apuro.

## Decisiones de negocio pendientes
- Conversión de preventa a facturación.
- Saldos a favor al retomar un borrador.
- Reglas CHECK por tipo de documento.
- **Saldo a favor de facturación por sucursal** (2026-11-17, el dueño lo confirma antes de cambiar nada). Hoy una DVV "se usa en facturación" crea un saldo del cliente completo, sin sucursal (`dvv-effect.strategy.ts` guarda `customerBranchId` solo con `administracion`), y la venta lo muestra en cualquier sucursal (`documents-query.service.ts` `findAvailableCustomerCredits` filtra solo por cliente). Ejemplo: "Cadena Prueba 30 Sucursales SAS", DVV-000022/23 hechas en Sucursal 01 aparecen en ventas de cualquier sucursal. Si se cambia: guardar sucursal en saldos de facturación, filtrar al buscar y al aplicar (POS/COT), refrescar el panel al cambiar sucursal, y decidir qué pasa con los saldos que ya existen (tomar la sucursal de su DVV o dejarlos para todo el cliente). Toca dinero: plan + pruebas.
- **Módulo de saldos a favor por cliente y por proveedor** (2026-11-17): la tabla "Saldos a favor" se sacó de los estados de cuenta de CxP y CxC (quedan las tarjetas de total). Con ella se fue el botón "Anular" de los excedentes: hasta que exista el módulo, anular un excedente se hace por la API (`PATCH /accounts-receivable/excedentes/:id/void`). El módulo nuevo debe traer consulta por cliente/proveedor, origen y aplicaciones de cada saldo, y anular excedente.
- **Mejoras del reparto del saldo en recibos (PR #102, no bloqueantes)**: CHECK de base `credit_amount + discount_amount <= amount`; prueba de `findAll` de recibos que verifique el `select`; prueba de recibo viejo con `creditAmount` null que hoy es tautológica.

## Producción (detalle en `PENDIENTES-PRODUCCION.md`, local)
Scripts de importación, ruta `/health`, `pg_dump` diario a Backblaze y prueba de restauración, logs fuera del servidor, evaluar NestJS Observe, `.env` de producción y cambio de la clave de admin.
