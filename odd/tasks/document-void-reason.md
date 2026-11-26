# Motivo obligatorio al anular documentos sensibles + SAJ sin anulación

Compras, compras oficiales, devoluciones y entradas por ajuste piden motivo al anularse; la salida por ajuste deja de poder anularse (se corrige con una EAI). Ventas, traslados y preventas no cambian.

## Specs

- S1 — Motivo obligatorio al anular **CM, CMO, DVC, DVV, EAI**: el dueño ("dale", 2026-11-26) eligió "las operaciones más sensibles/delicadas por ejemplo compras".
- S2 — Una sola lista de motivos en la base (enum `DocumentVoidReason`, valores en español como los demás enums): `cantidad_equivocada`, `producto_equivocado`, `costo_equivocado` (pantalla: "Costo o precio equivocado"), `proveedor_equivocado`, `cliente_equivocado`, `bodega_equivocada`, `documento_duplicado`, `operacion_no_realizada`, `otro`. Cada tipo solo acepta los suyos:
  - CM, DVC: todos menos `cliente_equivocado`.
  - CMO: todos menos `cliente_equivocado` y `bodega_equivocada`.
  - DVV: todos menos `proveedor_equivocado`.
  - EAI: `cantidad_equivocada`, `producto_equivocado`, `costo_equivocado`, `bodega_equivocada`, `documento_duplicado`, `otro`.
  - `otro` exige texto (máx. 500). Un motivo que no aplica al tipo → 400.
- S3 — **SAJ no se puede anular**: el dueño "prefiero el movimiento contrario la verdad!" → 400 "La salida por ajuste no se anula: corrígela con una entrada por ajuste (EAI)." sin tocar stock. El frontend oculta "Anular" en SAJ. EAI sí se sigue anulando (única forma de dejar exacto el costo promedio; ya bloquea si hubo movimientos posteriores y cierra sus casos de inventario).
- S4 — Ventas (POS, COT, POSO, REM), traslados (T) y preventas (PV): sin motivo y sin cambios; quién anula no cambia en ningún tipo ("no puede tocar la anulación de ventas que hoy la anula administrador de cuentas").
- S5 — Se guarda `voidReason` / `voidReasonOther` en `document` (columnas nullable; documentos ya anulados quedan sin motivo) y el detalle del documento anulado lo muestra junto a "Anulado por…". El contrato `contracts/documents.ts` los expone.
- S6 — Pruebas solo de lo que bloquea (hábito 7): SAJ rechazado sin efectos; motivo faltante/no aplicable/"otro" sin texto → 400 y documento sigue confirmado; con motivo se guarda; venta se anula sin motivo con el permiso de siempre.

## Tasks

- T1 [S2,S3] regla de motivo por tipo + SAJ (helper `document-void-reason.helpers.ts` + pruebas) — parent — commit: pendiente
- T2 [S1,S2,S3,S4,S5,S6] migración, DTO, `DocumentVoidService`, controller, contrato, backend/CLAUDE.md — nestjs-code-crafter — commit: pendiente
- T3 [S1,S2,S3,S5] diálogo de anular con motivo por tipo, ocultar Anular en SAJ, motivo en el detalle, frontend/CLAUDE.md — react-code-crafter — commit: pendiente
- T4 verificación (pruebas, pantalla, mutaciones) y PR — parent — commit: pendiente

## Log

- L1 (dueño): "pero quisiera que fuera para las operaciones más sensibles/delicadas por ejemplo compras"
- L2 (dueño): "pero si tiene sentido que se permita la anulación de EAI Y SAJ?" → "prefiero el movimiento contrario la verdad!" → al saber que la anulación de EAI revierte el costo promedio exacto y el SAJ contrario no: se acordó EAI anulable con motivo, SAJ no anulable.
- L3 (dueño): "pero si comparten motivos?" → una lista, cada tipo muestra solo los suyos (tabla de S2) → "dale".
- L4: el rol que anula no cambia (antes: "la segunda, eso sí no puede tocar la anulación de ventas…").
- L5: evidencia — jest 814/814, vitest 240/240, tsc 0, build OK; migración solo CREATE TYPE + 2 columnas nullable, segundo diff solo trigram. API real: SAJ → 400 y sigue confirmado; DVV sin motivo → 400; CM con "otro" + texto → anulada, detalle con texto recortado; T sin body → anulado sin motivo. Pantalla: CM muestra solo sus 8 motivos (sin cliente), botón deshabilitado sin motivo y con "Otro" vacío; SAJ sin botón Anular; detalle anulado muestra "— Motivo: …". Mutaciones DETECTADAS: M1 quitar bloqueo SAJ (2 fallan), M2 servicio sin validar motivo (6 fallan), M3 front SAJ anulable (6 fallan). Datos dev anulados en pruebas: CM-000070? no (409 por movimientos posteriores), CM 01a1f03b…, T 01a1c65f…, DVV 01a1f9b7… (texto "ZZ E2E prueba motivo" en la CM).
