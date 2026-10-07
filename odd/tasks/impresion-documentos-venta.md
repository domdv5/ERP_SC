# Impresión de documentos de venta

## Objective
Permitir imprimir en PDF todos los documentos de venta (POS, COT, REM, DVV, PV, POSO) con la leyenda legal de documento preliminar.

## Problem / Why
Hoy solo CM y DVC tienen estrategia de impresión; el layout existente está atado a compras (usa `unitCost` y suma 19% de IVA encima).

## Decisions (user, 2026-10-07)
- Tipos: todos los de venta — POS, COT, REM, DVV, PV, POSO.
- IVA en venta: incluido en el precio. Total = lo cobrado (suma de subtotales); base = total / 1,19, IVA = total − base. POSO usa el `taxAmount` guardado por línea.
- Leyenda fija al pie: "ESTE ES UN DOCUMENTO PRELIMINAR, AUN NO CUENTA CON EL PROCESO DE VALIDACIÓN EN LA DIAN, LA FACTURA ELECTRONICA LLEGARÁ A SU CORREO UNA VEZ SE SURTA DICHO PROCESO. PASADOS 8 DÍAS NO SE ACEPTAN DEVOLUCIONES,CAMBIOS, NI RECLAMOS. LA ROPA INTERIOR NO TIENE CAMBIOS."
- Leyenda legal solo en POS, COT, REM y POSO; DVV y PV no la llevan (usuario, 2026-10-07).
- "Creó: <usuario> -- <fecha/hora de creación>" es dinámico (asumido, informado al usuario).

## Scope
- Backend: layout de venta (precio de venta, IVA incluido), leyenda, 6 estrategias, registro en registry/module.
- Frontend: botón Imprimir habilitado también para los tipos de venta.
- Docs: backend/CLAUDE.md (y frontend/CLAUDE.md si aplica).

## Constraints
- No tocar Safety Rules (auth, migraciones, bootstrap, seed RBAC, invariante BinStock). Sin migraciones.
- No crear archivos .spec.ts (preferencia del usuario).

## Tasks
- [ ] T1 — Backend: layout de venta + leyenda + estrategias POS/COT/REM/DVV/PV/POSO + docs. Route: delegated (nestjs-code-crafter; writer trigger: 2+ archivos no triviales).
- [ ] T2 — Frontend: condición del botón Imprimir incluye tipos de venta. Route: delegated (react-code-crafter; routing rule del repo para todo cambio frontend).

## Checks
- backend: `pnpm run build` (tsc) en backend/.
- frontend: `pnpm run build` en frontend/.
- Funcional: GET /documents/:id/print devuelve PDF para un documento de venta confirmado.
- TDD: no aplica (sin suite de tests en estas áreas; usuario no quiere .spec auto-generados) — checks de build + prueba funcional.

## Delivery
- Forecast ~300 líneas. Strategy: ask-on-risk. Branch: feature/impresion-documentos-venta. RDD: on (global).

## Progress / Evidence
- T1 implementado (sin commit): `pnpm run build` backend exit 0 (writer + spot check del padre). POSO: precios sin IVA, usa `taxAmount` guardado (tax.helpers.ts:15-19). Leyenda off en DVV/PV.
- T2 implementado (sin commit): `PRINTABLE_TYPES` en DocumentDetailPage.tsx; `pnpm run build` frontend OK.
- RDD: riesgo medio, consentimiento granted, lente review-reliability → approved y acknowledged (lineage review-a7cdd275c890c369).
- Extras pedidos por el usuario: número del documento en el encabezado (todos los tipos) y "Vendedor:" en ventas; dirección/teléfono vacíos se omiten y márgenes superiores ajustados (venta 120, compra 110) porque pdfmake recorta el header.
- Prueba visual con servidor temporal :3011: POS, POSO, DVV y CM 000009 renderizados OK (leyenda, número, vendedor, sin recortes). Peor caso de venta con dirección+teléfono+vendedor no renderizado (no hay datos), solo calculado.
- RDD: reviews approved+acknowledged sobre el workspace final (review-19c9a1821ece4d8b).
- [x] T1 [x] T2 — commit con OK del usuario.

## Next step
Push/PR a decisión del usuario.
