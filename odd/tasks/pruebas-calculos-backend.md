# Pruebas de cálculos de dinero (backend, fase 1)

## Objective
Primeras pruebas automáticas del repo: funciones puras de IVA/totales del backend, con Jest (ya instalado).

## Problem / Why
El repo tiene cero pruebas; los cálculos de IVA y redondeo afectan dinero y un error no se nota a simple vista. El usuario autorizó arrancar (2026-10-07) para ver cómo funciona.

## Scope
- `backend/src/documents/helpers/tax.helpers.ts` → `tax.helpers.spec.ts` (computeOfficialLine, officialNetFloor, sumOfficialLines, OFFICIAL_TAX_TYPES).
- `backend/src/documents/print/helpers/pdf-totals.helper.ts` → `pdf-totals.helper.spec.ts` (computeItemIva, splitIncludedIva, computeSaleUnitValues, computeSalePrintTotals, computePrintTotals).
- Docs: sección de pruebas en backend/CLAUDE.md.

## Constraints
- Sin BD, sin mocks de Prisma, sin cambiar código de producción. Si una prueba revela un bug real, se reporta, no se corrige en esta tarea.
- Fuera de alcance: pre-commit hook, CI, frontend/Vitest, BD de prueba (fases siguientes, a decisión del usuario).

## Tasks
- [ ] T1 — Specs de tax.helpers y pdf-totals.helper + docs. Route: delegated (nestjs-code-crafter; routing rule del repo para backend, 2 archivos no triviales).

- [x] T2 — Specs de computeNewAvgCost/computeReversedAvgCost (tx falso), toCents, date-range.util, buildPvStatus, IsValidChequeReference; mismo PR #7 (usuario, 2026-10-07). Route: delegated (nestjs-code-crafter).

## Checks
- `pnpm test` en backend/ (todas en verde), `pnpm run build`.
- TDD: no aplica RED/GREEN — son pruebas de caracterización sobre código existente; se valida que fallen al romper un valor (prueba de sanidad).

## Delivery
- ~250 líneas. Strategy: ask-on-risk. Branch: feature/pruebas-calculos-backend.

## Progress / Evidence
- [x] T1: 41 pruebas (tax.helpers 17, pdf-totals 24), `pnpm test` 41/41 en 0,5 s (writer + spot check del padre), `pnpm run build` OK. Prueba de sanidad: un valor roto → 1 falla. Sin bugs encontrados. Jest ya resolvía el alias `@/`.

- Agregado por pedido del usuario: `"types": ["node","jest"]` en backend/tsconfig.json (VS Code usa TS 6.0.3, que no carga @types solo → TS2593; verificado 46→0 errores con TS 6 y 0 con TS 5.9).
- Hook `.githooks/pre-commit` corre Jest si hay `.ts` de backend staged; probado: pasa con 41/41 y bloquea con 1 prueba rota.
- CI `.github/workflows/ci.yml` (PR a main: install, prisma generate con DATABASE_URL ficticia, test, build). CD descartado por ahora (no hay servidor).
- RDD: review-2680fae952f69984 approved+acknowledged (antes de ci.yml).

- T2: 50 pruebas nuevas en 5 archivos (13+8+9+9+11), total 91/91 (writer + spot check del padre), tsc sin errores, sin bugs.

## Next step
Push/PR a decisión del usuario; ver el check de CI en el PR. Opcional: regla de rama en GitHub que exija el check.
