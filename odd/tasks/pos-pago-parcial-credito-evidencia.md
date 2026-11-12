Evidencia de pruebas — POS con parte a crédito (rama `feat/pos-partial-credit`, 2026-11-12).
Regla: hábito 5 del CLAUDE.md raíz. Spec: `odd/tasks/pos-pago-parcial-credito.md`.

## Qué código revisar, por criticidad

| Nivel | Dónde | Regla | Qué se rompe si está mal |
|---|---|---|---|
| Crítico | `backend/src/documents/strategies/pos-effect.strategy.ts:132` | CxC por el monto exacto de la línea crédito | El cliente queda debiendo más o menos de lo real, sin aviso |
| Crítico | `backend/src/documents/strategies/pos-effect.strategy.ts:82-83` | Bloqueo del cliente (`FOR UPDATE`) antes de validar el cupo | Dos ventas simultáneas pasan el cupo entre las dos |
| Crítico | `backend/src/documents/strategies/pos-effect.strategy.ts:64-73` | Formas de pago (crédito incluido) = total − saldos a favor; bloqueo del 100% | Venta con plata que no cuadra o POS que en realidad es una COT |
| Crítico | `backend/prisma/migrations/20261112120000_payment_method_credito/migration.sql` | Agrega `credito` al enum | Si falla al desplegar, no arranca la versión nueva (no borra datos) |
| Alto | `backend/src/documents/strategies/pos-effect.strategy.ts:36-37` | Cupo validado al guardar | El cajero se entera del cupo recién al confirmar |
| Alto | `backend/src/documents/strategies/poso-effect.strategy.ts:58` | POSO rechaza crédito | Venta oficial (M2) con deuda |
| Alto | `backend/src/documents/document-void.service.ts:115, 307` | Anular borra la CxC y se bloquea si tiene abonos (código previo, sin cambios) | CxC huérfana o abono perdido |
| Medio | `frontend/src/pages/documents/pos-checkout.utils.ts:139-163` | Cuándo se ofrece Crédito, monto, cupo excedido, 100% | El cajero ve la opción donde no va o confirma algo que el backend rechaza (el backend igual bloquea) |
| Medio | `frontend/src/pages/documents/pos-checkout/PaymentLinesField.tsx:98-120` | Línea compacta de cupo | Mensaje confuso; sin efecto en datos |
| Bajo | `backend/src/documents/print/blocks/payments-box.block.ts` | Formas de pago y "Pagado / A crédito" en el PDF | Solo visual |
| Bajo | `frontend/src/pages/documents/DocumentDetailPage.tsx:823-838` | "Pagado / A crédito" en el detalle | Solo visual |

## Conteos reales (2026-11-12)

- Backend `jest`: 64 suites, 674 pruebas, todas pasan. `tsc --noEmit`: sin errores.
- Frontend `vitest run`: 20 archivos, 217 pruebas, todas pasan. `tsc -b` y `pnpm build`: sin errores.
- Verificación independiente (`gentle-ai-verify`): S1-S8 y D1-D6 pasan; S5 y S6 solo con mocks.
- Revisión nativa (riesgo, resiliencia, confiabilidad): aprobada, sin bloqueantes (`review-004c7d8c40f36370`).

## Prueba de mutación: se rompe cada regla y la prueba tiene que fallar

Cada fila: se cambió esa línea en el código real, se corrió la prueba indicada y se restauró el archivo (después, `git diff` real vacío).

| # | Mutación (qué se rompió) | Resultado | Prueba que la atrapó |
|---|---|---|---|
| M1 | CxC por `amountToCollect` en vez del crédito | DETECTADA | `pos-effect.strategy.spec.ts` — "crea una sola CxC por el monto de la línea crédito y bloquea al cliente" |
| M2 | Se quitó el `FOR UPDATE` del cliente | DETECTADA | mismo test (verifica la consulta de bloqueo) |
| M3 | No validar el cupo al confirmar | DETECTADA (2 pruebas) | "crea una sola CxC…" y "cupo excedido en confirm: propaga el 400 y no crea CxC" |
| M4 | No bloquear el crédito al 100% | DETECTADA (2 pruebas) | "crédito igual al total a cobrar: 400…" y "con saldos a favor, el 100% se mide contra el total menos los saldos" |
| M5 | No validar el cupo al guardar | DETECTADA | "validateCreate con línea crédito valida el cupo sobre ese monto" |
| M6 | Regla del 100% con `>` en vez de `>=` (borde exacto) | DETECTADA | `payment.helpers.spec.ts` — "rechaza crédito por el 100% y manda a la venta a crédito" |
| M7 | POSO acepta crédito | DETECTADA | `poso-effect.strategy.spec.ts` — línea crédito → 400 |
| M8 | Anular no borra la CxC | DETECTADA | `documents.service.void.spec.ts` — POS con CxC |
| M9 | Anular no bloquea una CxC con abonos | DETECTADA | `documents.service.void.spec.ts` — bloqueo 409 previo |
| M10 | Frontend ofrece Crédito en M2 | DETECTADA (2 pruebas) | `pos-checkout.utils.test.ts` "canOfferCredit: no en M2 ni sin cliente" y `PaymentLinesField.test.tsx` "no ofrece Crédito en M2 (oficial)" |

10 de 10 detectadas: no hay regla crítica o alta que se pueda romper sin que una prueba falle.

## Qué NO garantizan estas pruebas

- Son pruebas unitarias con mocks: el `FOR UPDATE` se verifica como "se ejecutó la consulta", no como bloqueo real en Postgres con dos ventas simultáneas.
- La migración se aplicó en la base local de desarrollo, pero ninguna prueba automática confirma un POS con crédito contra una base real.
- La pantalla no se recorrió en un navegador; el PDF no se generó de verdad.
- Pasos para probar a mano: sección "Qué no se probó" de la entrega del 2026-11-12.
