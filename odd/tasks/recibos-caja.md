# Recibos de Caja (contraparte de Egresos, lado CxC)

## Objetivo

Implementar el módulo de Recibos de Caja: un recibo paga una o varias CxC de UN mismo cliente en un solo movimiento, mismo patrón que `EgresosModule` (Egreso/EgresoPayment/EgresoAllocation) pero del lado cliente, sin aplicación de saldo a favor (regla explícita del usuario).

## Por qué / contexto

`AccountsReceivable` nunca recibió el rework que `AccountsPayable` tuvo en la migración `20260918120000_egresos_and_ap_rework` — sigue sin `paidAmount` cacheado, sin CHECKs, con `ReceivablePayment` como modelo de pago directo (sin idempotencia, sin multi-cuenta). Para que Recibo de Caja funcione, hay que replicarle a AR el mismo rework que tuvo AP.

## Alcance autorizado (spec del usuario + 2 decisiones confirmadas)

1. Roles con acceso: `accounts_admin`, `accounts_assistant` — y también `admin` (confirmado por usuario, mismo patrón que egreso.*/ap.*/ar.*).
2. Consecutivo vía tabla `Sequence` existente, clave `'RECIBO_CAJA'` (ya anticipada en el comentario del schema).
3. Formas de pago: reutilizar el enum `EgresoPaymentMethod` tal cual (mismo enum, sin duplicar).
4. Idempotency Key igual que Egresos (columna única + comparación de reintento).
5. Selector de tercero: solo `Customer`.
6. Campo fecha obligatorio (mismo criterio de "no futura", huso Bogotá, igual que Egresos).
7. Un recibo puede saldar varias CxC del mismo cliente (mismo patrón multi-cuenta de Egresos).
8. Datos legados inconsistentes en CxC: auditado — no se encontró ninguna CxC fraccionaria (0 filas). Los 2 únicos `receivablePayments` existentes están limpios. No hace falta corrección de datos.
9. Cuadre exacto (Σ formas de pago = Σ CxC saldadas), sin tolerancia — mismo criterio que el fix reciente de Egresos.
10. Se conserva qué usuario hizo el recibo (`userId`).
11. **Sin saldo a favor del cliente en este flujo** — no hay líneas de crédito, a diferencia de Egresos.
12. Las CxC actualizan `status` (`pending`/`partial`/`paid`) según el saldo pendiente.
13. Índices en las tablas nuevas siguiendo la convención existente (mirror exacto de `egreso`/`egreso_payment`/`egreso_allocation`).
14. **Decisión confirmada con el usuario**: se elimina `POST /accounts-receivable/:id/payments` (mismo precedente que la eliminación de `POST /accounts-payable/:id/payments` cuando se implementó Egresos) — nadie en el frontend lo usa hoy.

## Tareas

- [x] 1. Schema + migración manual: `AccountsReceivable.paidAmount` + CHECKs (mirror AP), modelos `ReciboCaja`/`ReciboCajaPayment`/`ReciboCajaAllocation`, índices. Ruta: inline. Migración `20260922160000_recibo_caja`, backfill verificado en BD real.
- [x] 2. `RecibosCajaModule` (service/dto/controller/module), registrado en `app.module.ts`. Ruta: inline.
- [x] 3. Integrar en `documents.service.ts::void()`: bloquear anulación de venta a crédito si hay `reciboCajaAllocations`, en el chequeo pre-tx y en el re-chequeo con `FOR UPDATE`. Retirar `POST /accounts-receivable/:id/payments` (controller, service, dto, index) y reescribir `AccountsReceivableService` a solo lectura con `balance`/`history` derivados (mismo patrón que `AccountsPayableService`). Ruta: inline.
- [x] 4. RBAC: `recibo.read`/`recibo.create` sembrados a `admin`, `accounts_admin`, `accounts_assistant` — verificado en BD (`role_permission`).
- [x] 5. Documentado en `backend/CLAUDE.md`: bullet nuevo de `RecibosCajaModule`, `AccountsReceivableModule` reescrito como "reworkeado a solo consulta", bullets de Database (`AccountsReceivable.paidAmount`, `ReciboCaja/ReciboCajaPayment/ReciboCajaAllocation`, `Sequence`), párrafo de RBAC roles.
- [x] 6. Build limpio + 25/25 pruebas funcionales en vivo (cuadre exacto, descuadre real rechazado, idempotencia + conflicto, CxC ya pagada, cliente equivocado, cheque sin/con referencia, fecha futura, multi-forma-de-pago, bloqueo de `void()`, endpoint viejo 404, `history` con fuente `recibo_caja`, `open-items`). Confirmado que frontend no usa el endpoint retirado (sin página de CxC implementada, solo "Coming Soon").
- [x] 7. Estrategia de entrega confirmada con el usuario: un solo commit (diff ~1100 líneas, cambio coherente ya verificado end-to-end). Review RDD corrida y aprobada (`review-d9bd435133316577`, acknowledged) — encontró 1 bug CRITICAL real (orden del CASE de reparo de status en la migración, corregido en `97b45c2`) y 4 hallazgos menores no bloqueantes (idempotencia bajo carrera, redondeo de payment.amount, formato de fecha, UUID sin validar en rutas), todos corregidos por pedido del usuario en `c74615c` y verificados con smoke test.

**Estado final**: rama `feature/recibos-caja` pusheada a `origin` (3 commits: `f318ede`, `97b45c2`, `c74615c`). Sin PR creado todavía — el usuario no lo pidió, solo push.

## Verificación

- `pnpm run build` sin errores.
- Prueba funcional en vivo: crear cliente/CxC de prueba (vía COT), crear recibo de caja parcial + total, verificar estado de CxC, verificar bloqueo de `void()`, verificar rechazo por descuadre/fecha futura/cliente equivocado/CxC ya pagada.
- Sin tests automatizados en el repo (baseline: `pnpm test` siempre da "no tests found", no es regresión).

## TDD

Desactivado — mismo baseline que el resto del repo (0 archivos `.spec.ts`). Verificación funcional vía API en vivo, como se hizo con Egresos.

## Estrategia de entrega

`ask-on-risk` (default). Se espera superar ~400 líneas; se preguntará por la estrategia de PR cuando se acerque el presupuesto.
