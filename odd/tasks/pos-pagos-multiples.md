# POS con varias formas de pago

Venta de contado (POS y POS oficial) con una o varias formas de pago cuyos montos suman el total a cobrar.
Rama `feat/pos-pagos-multiples`; un commit por tarea; PR al final.

## Specs
- S1 — "UNICAMENTE en el POS se necesita poder seleccioanr varias formas de pago ya que puede occurir que se pague en varia formas, obviamente esa formas deben sumar el total a cobrar". Aplica a POS y POSO; ningún otro tipo de documento cambia.
- S2 — Datos: tabla nueva `DocumentPayment` (documento, forma de pago `PaymentMethod`, monto). Las ventas existentes con `paymentMethod` quedan con una línea por lo cobrado (total − saldos a favor aplicados); luego se elimina la columna `Document.paymentMethod`. Confirmado por el usuario.
- S3 — Al confirmar contado (POS/POSO): al menos una forma de pago, cada monto > 0, sin repetir forma de pago, y la suma = total a cobrar (total del documento, con IVA en POSO, menos saldos a favor aplicados). Si no cuadra, se rechaza diciendo cuánto falta o sobra. Sin vuelto.
- S4 — Venta a crédito (COT): sin formas de pago, como hoy.
- S5 — Pantalla POS: lista de filas (forma de pago + monto) con botón "Agregar forma de pago"; la primera fila arranca con el total; se muestra cuánto falta o sobra. El borrador retomado recupera sus formas de pago.
- S6 — Convertir preventa/remisión a POS ya no pide forma de pago en el aviso de conversión: se eligen en el checkout antes de confirmar (decisión técnica: el monto a cobrar recién se conoce ahí).

## Tasks
- [x] T1 — S2 — Schema `DocumentPayment` + migración con backfill y drop de columna. Route: inline (migración, Safety Rule confirmada).
- [x] T2 — S1,S3,S4,S6 — Backend: DTO `payments`, create/update/convert, idempotencia, validación al confirmar POS/POSO, specs, backend/CLAUDE.md. Route: regla de negocio inline + scaffolding nestjs-code-crafter.
- [x] T3 — S1,S5,S6 — Frontend: tipos, filas de pago en POS, borrador, conversión sin forma de pago, frontend/CLAUDE.md. Route: react-code-crafter (lógica de suma inline).
- [x] T4 — Verificación independiente (jest, build, tsc, contrato front/back). Route: gentle-ai-verify.

## Evidence
- T1: migración `20261027120000_document_payments` aplicada en local; backfill 49→48 líneas (1 venta cubierta 100% con saldo a favor), confirmadas efectivo 6.566.025 − 347.900 = 6.218.125.
- T2: `assertPaymentsMatchTotal` RED (módulo inexistente) → GREEN 9/9 (padre); resto nestjs-code-crafter. jest 36/36 suites, 287/287; build OK.
- T3: helpers `calculatePaymentDifference`/`arePaymentsValid` (padre) + UI react-code-crafter; tsc OK.
- T4 gentle-ai-verify: S1-S6 pasan; jest 287/287, build OK, tsc OK. Obs. 1 (DocumentListItem.payments obligatorio) corregida a opcional; obs. 2 (payments aceptados en tipos no contado, ignorados) se deja; obs. 3 sin cambio. Sin prueba visual.

## Log
- L1 (2026-10-27, usuario): "mira te voy a apsar varias correcion pero vamos hacerla una a una para que se peuda revisar una a una facilemnte \n\nla primera seria que UNICAMENTE en el POS se necesita poder seleccioanr varias formas de pago ya que puede occurir que se pague en varia formas, obviamente esa formas deben sumar el total a cobrar"
- L2 (2026-10-27, usuario): aprobó la propuesta con migración, backfill y eliminación de la columna ("Sí, hacelo así").
