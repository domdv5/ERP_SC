# Módulo de Informes (Dashboard)
Nuevo ítem "Informes" en el sidebar, solo admin, con gráficos interactivos: inventario, rotación, estado de cuenta y ventas por vendedora.
Branch: feat/informes. Fullstack: backend `reports/` + frontend página de informes.

## Specs
- S1 — Alcance (del pedido del usuario, sin edad de cartera): "Estado de inventario: Mayor rotación, Menor rotación, Bodegas separadas" / "Estado de cuenta: General: por pagar, por cobrar, Cuentas por pagar, Cuentas por cobrar" / "Ventas: Vendedoras con mayor venta". "por ahora lo pdoriamos hacer sin la edad de cartera de momento".
- S2 — Navegación y acceso: "un nuevo elemento en el sidebar que sea informes, lso roles que lo pueden ver son admin". Decisión: permiso `report.read` asignado solo a admin en el seed RBAC (aprobado; los admins re-inician sesión para recibirlo).
- S3 — Gráficos: "la idea es que sean con graficos que sea muy interactivo si me hago entender, no solo numero sino tambien graficos pero qeu no sea por tenerlos y ya sino que realemtne aporten". Decisión: Recharts.
- S4 — Rendimiento: "que sea full eficeinte , optimo en las consultas, cache etc etc etc". Decisión: cache solo en frontend (React Query staleTime); consultas agregadas en SQL, nada de traer filas para sumar en JS.
- S5 — Ventas por vendedora: netas (decisión del usuario). Neto = POS+COT confirmadas con esa vendedora − DVV confirmadas con esa misma `sellerId`. La DVV no enlaza la venta original, así que las DVV sin vendedora se reportan aparte como "devoluciones sin asignar". `POSO` se excluye (espejo de facturación oficial).
- S6 — Rotación: unidades netas vendidas por producto en un rango de fechas (POS+COT − DVV confirmadas, por `Document.date`), filtrable por bodega. Mayor = top por unidades; menor = productos con stock > 0 ordenados por menos unidades vendidas (incluye 0 ventas).

## API contract (todas `@Permissions('report.read')`, fechas `YYYY-MM-DD`, por defecto últimos 30 días)
- `GET /reports/inventory` → `{ warehouses: [{ warehouseId, name, units, costValue, productCount }], totals: { units, costValue, productCount } }` (costValue = Σ quantity × Product.avgCost).
- `GET /reports/rotation?from&to&warehouseId?&limit=10` → `{ top: RotationRow[], bottom: RotationRow[] }`, `RotationRow = { productId, code, description, unitsSold, salesAmount, stock }` (unitsSold puede ser negativo si hubo más devoluciones que ventas en el rango).
- `GET /reports/accounts?limit=10` → `{ payable: Totals, receivable: Totals, topSuppliers: [{ thirdPartyId, name, balance }], topCustomers: [...] }`, `Totals = { total, paid, balance, openCount }`.
- `GET /reports/sales-by-seller?from&to` → `{ sellers: [{ sellerId, name, grossSales, returns, netSales, documentCount }], unassignedSales, unassignedReturns, trend: [{ date, netSales }] }`.
- Montos como number con 2 decimales.

## Tasks
- [x] T1 — S2: permiso `report.read` en seed + mapeo a admin. Route: inline. Commit: pending (mostrar antes de commitear)
- [x] T2 — S1,S4,S5,S6: `backend/src/reports/reports.service.ts` con las 4 consultas agregadas (decisión de negocio). Route: inline. Commit: pending
- [x] T3 — S1,S2,S4: controller, DTOs, módulo, registro en AppModule, specs, backend/CLAUDE.md. Route: nestjs-code-crafter. Commit: pending
- [x] T4 — S1-S6: frontend: Recharts, ítem sidebar con `report.read`, página Informes con secciones y gráficos, hooks React Query, frontend/CLAUDE.md. Route: react-code-crafter. Commit: pending
- [x] T5 — Verificación integral S1-S6. Route: gentle-ai-verify. Commit: n/a

## Log
- L1 (usuario, 2026-10-13): "por ahora lo pdoriamos hacer sin la edad de cartera de momento, la idea seria un nuevo elemento en el sidebar que sea informes, lso roles que lo pueden ver son admin, la idea es que sean con graficos que sea muy interactivo si me hago entender, no solo numero sino tambien graficos pero qeu no sea por tenerlos y ya sino que realemtne aporten, seria un desarrollo fullstack, y por supeusto como venimos trabajo que sea full eficeinte , optimo en las consultas, cache etc etc etc"
- L2 (decisiones, 2026-10-13): ventas netas; permiso report.read; Recharts; cache solo frontend.
- L3 (hallazgo): DVV no tiene vínculo con la venta original → atribución por sellerId propio de la DVV; POSO excluido.
- L4 (evidencia T2): `tsc --noEmit` OK; las 4 consultas corridas contra la DB de desarrollo (2-20 ms cada una), resultados coherentes. Product no tiene `name` → contrato usa `description`. T1: seed no ejecutado (reemplaza permisos de todos los roles en la DB del usuario).
- L5 (evidencia T3/T4): backend jest 128/128 + tsc OK; frontend tsc -b OK, vite build OK, Recharts en chunk lazy `ReportsPage` (120 kB gzip).
- L6 (T5, gentle-ai-verify): S1-S6 cumplidos, sin bloqueantes. Defecto menor corregido: ventas POS/COT sin vendedora se perdían del KPI → nuevo campo `unassignedSales` (RED→GREEN, jest 129/129, tsc front/back OK). Observación: las 12 DVV de la DB de desarrollo no tienen vendedora → todas salen como "sin asignar". Sin verificar: render visual, clics de cross-filter, 403 real por HTTP.
- L7 (usuario, revisión visual): "en el modo oscuro en selector de fechas no se ve bien, y segundo no hay un boton para recargar en caso de que haya nueva infoamcion dado que no es en timepo real y tener que recargar con f5 no seria lo emjnor"
- L8 (fix L7, react-code-crafter): `color-scheme` light/dark en `:root`/`.dark` de index.css (global: arregla todos los date inputs nativos); botón "Actualizar" en ReportsPage (refetch de queries `['reports']` activas, spinner con useIsFetching, "Actualizado HH:MM"). tsc -b + vite build OK; render no verificado por el agente.
