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
- [x] 3. Commit de work-unit en la rama `feature/recibos-caja` (conventional commit).

## Ruta de implementación
Delegated direct — write rule (4 archivos no triviales) dispara delegación obligatoria a un solo writer (`react-code-crafter`).

## Tasks — ronda 2 (fixes del reviewer, ampliado a AP por decisión del usuario)
- [ ] 4. Corregir 4 de los 5 hallazgos no bloqueantes del reviewer (deja fuera el de falta de tests). Los 4 son bugs preexistentes en `accounts-payable` copiados tal cual al espejar `accounts-receivable` — usuario decidió corregir ambos módulos para no abrir una inconsistencia nueva entre ellos:
  - `formatDate` (`accounts-receivable.utils.ts` **y** `accounts-payable.utils.ts`): agregar `timeZone: 'America/Bogota'` a `toLocaleDateString` (mismo huso ya usado en backend para Egresos/Recibos de Caja) — evita que una fecha guardada en UTC medianoche se muestre un día antes.
  - Reset de página (`AccountsReceivableListPage.tsx` **y** `AccountsPayableListPage.tsx`): mover `setPage(1)` del `useEffect` post-render a los propios handlers de cambio de búsqueda/filtro, para no disparar una consulta intermedia con filtro nuevo + página vieja.
  - Estadística "Pendientes" (mismos dos archivos): hoy solo cuenta `status: 'pending'`, dejando fuera `partial` (que también tiene saldo pendiente). Sumar el conteo de `partial` al de `pending` en la tarjeta "Pendientes" (consulta adicional por `status: 'partial'`, igual patrón que las consultas de conteo ya existentes).
  - Fallback ante status/origen desconocido (`StatusBadge.tsx` de ambos módulos + el `ORIGIN_BADGE[entry.source]` en ambos `*DetailPage.tsx`): no debe crashear si el backend manda un valor fuera del enum esperado — degradar a un badge neutro en vez de `undefined.className`.

## Tasks — ronda 3 (hallazgos de /ultrareview sobre el PR #2)
- [x] 5. Bug real y confirmado en `CotEffectStrategy.confirm()` (backend/src/documents/strategies/cot-effect.strategy.ts): una sobre-aplicación de saldos a favor del cliente hacía `netCents` negativo y el `INSERT` en `accounts_receivable` violaba el CHECK `accounts_receivable_paid_amount_range_chk` agregado hoy (Postgres crudo, 500 en vez de 400). Implementado YO MISMO (decisión de negocio real, no delegado): guard agregado antes de crear la cuenta, mismo mensaje que ya usa `applyCustomerCredits`. Verificado leyendo el CHECK real de la migración y el flujo completo antes de escribir el fix. `tsc --noEmit` del backend limpio.
- [x] 6. Timezone faltante en `RecibosCajaListPage.tsx`/`ReciboCajaDetailPage.tsx`/`RecibosCajaNewPage.tsx` — mismo bug que se corrigió hoy en AR/AP, colado en 3 páginas creadas en sesión anterior.
- [x] 7. `RecibosCajaListPage.tsx` mantiene el viejo patrón `useEffect(() => setPage(1), [...])` que ya se reemplazó en AR/AP por el patrón de reset durante el render.
- [x] 8. Validador `IsValidChequeReference` duplicado verbatim entre `create-egreso.dto.ts` y `create-recibo-caja.dto.ts` — extraído a `backend/src/common/validators/is-valid-cheque-reference.validator.ts`.
- [x] 9. Función `toCents()` reimplementada 5 veces en el backend — extraída a `backend/src/common/utils/money.util.ts`, los 5 archivos ahora importan de ahí.

## Progreso — ronda 3
- Delegado a `react-code-crafter` (tasks 6-7) y `nestjs-code-crafter` (tasks 8-9) en paralelo, dominios sin archivos compartidos.
- Verificación del orquestador: `git status`/`git diff --stat` coinciden con lo reportado por ambos agentes; `pnpm exec tsc --noEmit` limpio en `backend/` y `frontend/`; inspeccionado el diff de `cot-effect.strategy.ts` para confirmar que el import de `toCents` compartido no pisó mi fix manual (task 5).
- Los 5 hallazgos de `/ultrareview` sobre el PR #2 quedan corregidos.

## Progreso — ronda 1/2
- Agente `react-code-crafter` completó la implementación: creó `accounts-receivable.types.ts`, `accounts-receivable.service.ts`, `accounts-receivable.utils.ts`, `StatusBadge.tsx`, `AccountsReceivableListPage.tsx`, `AccountsReceivableDetailPage.tsx`; modificó `types/index.ts`, `router/index.tsx` (reemplazó `ComingSoonPage` en `/accounts-receivable` por las páginas reales, gateado por `ar.read`, sin tocar `navigation.ts` porque el permiso ya existía ahí) y `frontend/CLAUDE.md`.
- Sin formulario de pago ni client-statement page, según lo fuera de alcance.
- **Verificación del orquestador (spot check)**: `git status`/`git diff --stat` coinciden con lo reportado por el agente; `pnpm exec tsc --noEmit` sin errores; confirmado que el import removido de `ComingSoonPage` no quedó huérfano.
- Commit de work-unit: `9579b15` — "feat(frontend): agregar pantalla de Cuentas por Cobrar" en `feature/recibos-caja`.
