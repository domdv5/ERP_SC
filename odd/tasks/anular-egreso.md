# Anular egreso

Anular un egreso revierte exactamente lo que hizo (abonos a CxP y saldos a favor usados) y deja registro de quién, cuándo y por qué.
Rama `feat/anular-egreso`. Toca dinero (CxP, saldos a favor), una migración aditiva y el seed RBAC (ambos confirmados por el dueño).

## Specs

- **S1** — Petición: "poder anualr un egreso, y que reviera todo lo que hizo efectiamente, y que deje quin lo anulo, cunado, etc etc etc".
- **S2** — Reversión de CxP: a cada cuenta por pagar abonada se le resta exactamente `EgresoAllocation.amount` de ese egreso (efectivo + saldo a favor) de `paidAmount`; los abonos de otros egresos/pagos se respetan. `status` se recalcula: `pending` si `paidAmount = 0`, `partial` si `0 < paidAmount < totalAmount`, `paid` si llega al total.
- **S3** — Reversión de saldos a favor: a cada `SupplierCredit` usado se le devuelve exactamente lo aplicado por ese egreso (`SupplierCreditApplication.amount`) a `balance`, y vuelve a `available`.
- **S4** — Ejemplo del dueño (debe cumplirse literal): Factura A 1.000.000 y Factura B 2.000.000; el egreso abona A 500.000 y B 2.000.000 (B queda pagada), usando 500.000 de saldo a favor de una DVC. Al anular: A debe 1.000.000 pendiente, B debe 2.000.000 pendiente, saldo a favor 500.000 disponible. Variante "cancelamos todo" (A 1.000.000 + B 2.000.000): al anular ambas vuelven a pendiente por su total y el saldo a favor a 500.000 disponible. Variante con otro egreso E2 que pagó después los 500.000 restantes de A: anular solo E1 deja A en 500.000 parcial.
- **S5** — Registro: el egreso no se borra; queda anulado con `voidedAt`, `voidedById` y `voidReason` (motivo **obligatorio**). Se sigue viendo en lista y detalle marcado "Anulado". El consecutivo no se reutiliza.
- **S6** — Sin límite de tiempo para anular.
- **S7** — Permiso nuevo `egreso.void`, para `admin` y `accounts_admin` ("Admin. de Cuentas"). Sin permiso → 403.
- **S8** — No se puede anular dos veces (incluido concurrente): el segundo intento falla y no cambia nada.
- **S9** — Bloqueos cruzados: los chequeos que impiden anular una compra (CM) o DVC por estar pagada/usada en un egreso no deben contar egresos anulados. Los listados/reportes de CxP siguen cuadrando (usan `paidAmount`/`status`, que se restauran).
- **S10** — Pantalla: botón "Anular" en el detalle del egreso (solo con `egreso.void`, oculto si ya está anulado) con confirmación que pide el motivo; banner "Anulado por X el día Y — Motivo: …"; en la lista la fila se marca "Anulado".
- **S11** — El sistema no lleva caja/bancos: anular no devuelve dinero; el texto de confirmación lo advierte en lenguaje simple.

## Tasks

- [x] **T1** (S2-S9) backend: migración aditiva, permiso seed, `POST /egresos/:id/void`, contrato, bloqueos cruzados, pruebas de dinero — route `nestjs-code-crafter` — commit: ca1c5b8 (slice 1, ~576 líneas; el frontend va en su propio commit)
- [x] **T2** (S5, S10, S11) frontend: botón, diálogo con motivo, banner, marca en lista — route `react-code-crafter` — commit: ver L6
- [x] **T3** (S4) verificación con base real (escenario del dueño) + docs CLAUDE.md — route parent — evidencia L5/L6

## Log

- **L1** (2026-11-18) Pedido original: "el siguiente que necesito es poder anualr un egreso, y que reviera todo lo que hizo efectiamente, y que deje quin lo anulo, cunado, etc etc etc"
- **L2** Ejemplo del dueño: "debemos 32 facturas una por 1 millon y otra por 2 milloens, abonamos (y pensalo tambien si cancelamos todo) en la pimera 500.000 + y en la segunda 2 millones, ademas se utilzio un saldo a favor de 500 mil de uan dvc, SE anula, enotnces que apraia?" — se respondió con las tablas de S4; el dueño aprobó.
- **L4** T1: jest 723/723, tsc 0, migración 20261118150000_egreso_void aplicada y seed corrido. Decisión del crafter a informar: anular una CM/DVC cuyo CxP/saldo tuvo un egreso YA ANULADO borra esas líneas (egreso_allocation/supplier_credit_application) del egreso anulado, porque la FK impide borrar la CxP; la cabecera del egreso anulado queda.
- **L5** T3 base real (API, proveedor Industrias Bogotá Textil): CM A 1.000.000, CM B 2.000.000, DVC 500.000. E1 000073 (A 500.000 + B 2.000.000, saldo 500.000, efectivo 2.000.000) y E2 000074 (resto de A). Antes: A paid, B paid, saldo 0 used. Anular E1 → 201; A 500.000 partial, B 0 pending, saldo 500.000 available (S2, S3, S4 caso 3). Segunda anulación → 409 'El egreso ya está anulado' sin cambios; motivo vacío → 400 'Indica el motivo de la anulación' (S5, S8). Anular E2 → A 0 pending (S4 caso 1). voided_at/void_reason/voided_by guardados. Anular CM B después → 409 por otra regla (movimientos de stock posteriores, costo promedio), no por el egreso; S9 queda cubierto solo por pruebas unitarias. Permiso 403 sin egreso.void: solo prueba unitaria.
- **L6** T2/T3 pantalla (Playwright, admin): detalle de EG-000073 muestra banner 'Anulado por admin el 18/11/2026 13:57:44 — Motivo: Prueba: pago digitado mal' sin botón Anular; lista marca EG-000073/074 'ANULADO' con montos tachados; EG-000072 muestra 'Anular' y el diálogo con motivo, botón deshabilitado vacío (no se confirmó). vitest 247/247, tsc 0. No probado: rol sin egreso.void en pantalla.
- **L3** Respuestas: "puena anualr el admin, y asitendte de ceuntas / si / no / si" → anulan admin y accounts_admin (el rol asistente fue eliminado el 2026-11-04; el dueño eligió "Admin. de Cuentas"), motivo obligatorio, sin límite de tiempo, migración y permiso confirmados.
