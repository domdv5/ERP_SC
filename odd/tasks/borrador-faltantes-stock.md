# Borrador con faltantes de stock

## Objective
Al abrir un borrador de venta/reserva, ver qué productos no tienen stock suficiente para poder pedir el ajuste de inventario.

## Problem / Why
Al confirmar una venta sin stock se muestran los faltantes y queda el borrador, pero al reabrir el borrador no hay forma de ver cuáles fallan. Pedido del usuario 2026-10-08.

## Decisions (usuario, 2026-10-09)
- Opción C: chip "⚠ N sin stock" en el encabezado del borrador que abre el `POSStockShortfallDialog` existente + filas afectadas marcadas en la tabla de líneas.
- Solo aparece si hay 1+ faltantes. Tipos: POS, COT, PV, REM (los que validan disponible con `assertBatchAvailability` al confirmar).
- Endpoint de solo lectura que usa exactamente la misma regla que confirm (misma exclusión de reserva propia/preventa origen).

## Tasks
- [x] T1 — Backend: método `findShortfalls(tx, document)` en las estrategias POS/COT/PV/REM, usado por confirm (punto de decisión de negocio). Route: inline.
- [x] T2 — Backend: `GET /documents/:id/stock-shortfalls` (document.read, solo borradores; tipos sin la regla → []) + specs + backend/CLAUDE.md. Route: delegated (nestjs-code-crafter).
- [x] T3 — Frontend: hook + chip en DocumentDetailPage + filas marcadas + dialog reutilizado con texto para borrador + frontend/CLAUDE.md. Route: delegated (react-code-crafter).
- [x] T4 — Verificación: backend test + build, frontend tsc. Route: gentle-ai-verify.

## Delivery
Branch: feature/borrador-faltantes-stock. Un commit por tarea; al final PR + merge + main local actualizado.

## Progress / Evidence
- T1: spec `strategies/find-shortfalls.spec.ts` RED 5/5 → GREEN 5/5; `tsc --noEmit` OK. confirm de POS/COT/PV/REM ahora llama a `findShortfalls`. Sin commit todavía (preferencia: mostrar cambios antes de commitear).
- T2 (nestjs-code-crafter): controller + `findStockShortfalls` en service + spec `documents.service.find-stock-shortfalls.spec.ts`; jest 9/9, tsc OK; backend/CLAUDE.md. Exige document.read + document.create.{TIPO}.
- T3: helper `canCheckStockShortfalls` (padre) + chip/filas/dialog/hook/servicio (react-code-crafter); tsc -b 0 errores. Padre quitó staleTime 5 min de la query (stock cambia por fuera). Sin prueba visual.
- T4 (gentle-ai-verify): jest 110/110 (10 suites), `pnpm run build` OK, frontend `tsc -b` OK; ruta y tipos consistentes front/back. Prettier: solo CRLF + formato en find-shortfalls.spec.ts (lo corrige el pre-commit hook).
- RDD: review-25f6088a0c931aaf approved + acknowledged (workspace sobre dbceaeb). 4 avisos no bloqueantes (R3-001..004: DocumentDetailPage query, service permiso/orden y llamada a findShortfalls, helper de permisos).
- Pendiente: prueba visual del usuario, commits y PR.
