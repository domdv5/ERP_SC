# Cuentas por Cobrar — Frontend

## Objetivo
Agregar la pantalla de Cuentas por Cobrar (CxC) en el frontend, espejo de Cuentas por Pagar (AP), que ya existe. El backend (`AccountsReceivableModule`) ya está implementado y documentado en `backend/CLAUDE.md` — este trabajo es 100% frontend.

## Por qué
El backend de CxC (`GET /accounts-receivable`, `GET /accounts-receivable/:id`) existe desde antes pero nunca tuvo página propia. Hoy se completó Recibos de Caja (cobro de CxC), lo cual hace evidente el hueco: no hay dónde ver las CxC ni su historial de abonos.

## Alcance
- Servicio `frontend/src/services/accounts-receivable.service.ts` — mismo patrón que `accounts-payable.service.ts` (list paginado + detail).
- `frontend/src/pages/accounts-receivable/AccountsReceivableListPage.tsx` — mismo patrón que `AccountsPayableListPage.tsx` (filtros `status`/`clientId`/`search`, paginación, columna `balance`).
- `frontend/src/pages/accounts-receivable/AccountsReceivableDetailPage.tsx` — mismo patrón que `AccountsPayableDetailPage.tsx` (balance derivado + historial unificado `history[]`: fuentes `recibo_caja` y `pago_historico`, ver shape exacto en `backend/CLAUDE.md` → `AccountsReceivableModule`).
- `frontend/src/pages/accounts-receivable/components/StatusBadge.tsx` (o reutilizar si el de AP es genérico) para `AccountsReceivableStatus` (`pending | partial | paid`).
- Wiring: ruta nueva en `frontend/src/router` + entrada de menú en `frontend/src/config/navigation.ts`, gateado por permiso `ar.read`.

## Explícitamente fuera de alcance
- **Sin formulario de registrar pago** en esta pantalla — ese flujo ya vive en el módulo de Recibos de Caja (`frontend/src/pages/recibos-caja`, con pantalla propia `RecibosCajaNewPage.tsx`), shippeado hoy. La CxC es de solo consulta (`POST /accounts-receivable/:id/payments` fue eliminado en backend).
- **Sin "estado de cuenta de cliente"** — a diferencia de AP (`AccountsPayableSupplierStatementPage.tsx`), el backend de AR no tiene endpoint `/clients/:id/statement`. No inventar uno.

## Decisión de negocio real
Ninguna — es maquetación pura que espeja un patrón ya establecido (AP) contra un backend ya construido y documentado. Sin ramas de validación nuevas, sin DTOs nuevos, sin lógica condicional nueva. Se delega 100% a `react-code-crafter`, sin checkpoint.

## Modo TDD
Off — repo sin `.spec.ts` (baseline conocido, ver memoria de sesión). Verificación funcional: `pnpm build`/typecheck en frontend.

## Tasks
- [x] 1. Delegar a `react-code-crafter` la implementación completa (servicio + list page + detail page + StatusBadge + wiring de router/nav), instruyéndolo a invocar `Skill(vercel-react-best-practices)` y `Skill(typescript-advanced-types)` como primer paso, y a leer como referencia exacta: `accounts-payable.service.ts`, `AccountsPayableListPage.tsx`, `AccountsPayableDetailPage.tsx`, `StatusBadge.tsx` (AP), `RecibosCajaListPage.tsx`/`ReciboCajaDetailPage.tsx` (para el patrón de historial combinado), y el bloque `AccountsReceivableModule` de `backend/CLAUDE.md` para el contrato exacto de endpoints/permisos.
- [x] 2. Verificar build/typecheck del frontend.
- [ ] 3. Commit de work-unit en la rama `feature/recibos-caja` (conventional commit).

## Ruta de implementación
Delegated direct — write rule (4 archivos no triviales) dispara delegación obligatoria a un solo writer (`react-code-crafter`).

## Progreso
- Agente `react-code-crafter` completó la implementación: creó `accounts-receivable.types.ts`, `accounts-receivable.service.ts`, `accounts-receivable.utils.ts`, `StatusBadge.tsx`, `AccountsReceivableListPage.tsx`, `AccountsReceivableDetailPage.tsx`; modificó `types/index.ts`, `router/index.tsx` (reemplazó `ComingSoonPage` en `/accounts-receivable` por las páginas reales, gateado por `ar.read`, sin tocar `navigation.ts` porque el permiso ya existía ahí) y `frontend/CLAUDE.md`.
- Sin formulario de pago ni client-statement page, según lo fuera de alcance.
- **Verificación del orquestador (spot check)**: `git status`/`git diff --stat` coinciden con lo reportado por el agente; `pnpm exec tsc --noEmit` sin errores; confirmado que el import removido de `ComingSoonPage` no quedó huérfano.
- Pendiente: commit de work-unit.
