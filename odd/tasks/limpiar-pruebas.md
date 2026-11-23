# Limpiar pruebas innecesarias

Borrar o recortar pruebas que no cumplen el hábito 7 del CLAUDE.md raíz (textos, orden, forma exacta de queries, casos duplicados). Rama `chore/limpiar-pruebas`. Base: backend 73 suites / 753 tests, frontend 29 files / 252 tests.

## Specs

- **S1** — Pedido del dueño: "solamente deberia tener pruebas aquello que es critico, como los docuemntos, pagos, reibid dinero, ventas etc etc"; "si es algo visual o infinmo pues no tienen sentidio".
- **S2** — Nunca se borra una prueba que reproduce un bug arreglado (confirmar con el nombre/comentario del test y `git log` del archivo), ni una que cubra dinero, stock, permisos, autenticación o una validación que bloquea.
- **S3** — Se quedan explícitamente: `backend/src/contracts/documents.contract.spec.ts` (CI corre `tsc --noEmit` sobre él) y la lista fija de 14 tipos en `frontend/src/lib/document-permissions.test.ts` (obliga a decidir permisos de un tipo nuevo).
- **S4** — Borrar completos (backend): `documents/print/blocks/header.block.spec.ts`, `locations/locations.service.spec.ts`, `third-parties/third-parties.service.city.spec.ts`, `third-parties/third-parties.service.find-all.spec.ts`, `third-parties/third-parties.service.find-one.spec.ts`. Antes de borrar, confirmar que no contienen una regla de negocio (ej. un filtro `where` que excluye inactivos/tipo); si la contienen, recortar en vez de borrar y reportarlo.
- **S5** — Recortar (backend), solo el `it` / aserción indicada:
  - `print/blocks/credit-box.block.spec.ts`: aserciones del literal "A crédito" y formato `$ 200.000` (queda: la caja aparece solo con crédito).
  - `print/helpers/pdf-totals.helper.spec.ts`: el caso POSO duplicado (997.500 + 189.525) en `computeSalePrintTotals`, si repite exactamente el de `computeSaleUnitValues`.
  - `print/helpers/print-city.helper.spec.ts`: "no repite el nombre cuando ciudad y departamento…".
  - `third-parties/dto/customer-branch.dto.spec.ts`: casos `''`→null / `''`→undefined y aserción del texto "La ciudad no es válida" (queda: rechaza código mal formado).
  - `egresos/dto/create-egreso.dto.spec.ts` y `recibos-caja/dto/create-recibo-caja.dto.spec.ts`: solo la aserción del mensaje en español (queda el rechazo).
  - `common/utils/date-range.util.spec.ts`: `toDateColumnValue devuelve el día…`.
  - `reports/helpers/resolve-report-range.spec.ts`: `rechaza fechas inexistentes` (cubierto por date-range).
  - `reports/reports.service.spec.ts`: `getSalesBySeller` duplicado del segundo describe, solo si es duplicado exacto (los de conversión a número quedan).
  - `documents/strategies/strategy-flags.spec.ts`: `it.each` de `undoEffects` que solo comprueba que existe la función.
  - `documents/documents.service.find-missing-stock.spec.ts`: "devuelve el resultado… llamándola con (prisma, document)" (delegación pura).
  - `inventory-cases/inventory-cases.service.spec.ts`: dejar un solo 404 de los tres (~397, ~727, ~807) solo si prueban el mismo método; ~359 "devuelve las bodegas… ordenadas por nombre"; ~520 si repite ~493; ~556 si repite ~448.
  - `recibos-caja/recibos-caja.service.spec.ts`: ~317 si repite ~213/~533; 409 de idempotencia repetido (~128, ~331, ~546) dejar uno por flujo distinto; ~876 si repite ~821; ~881 si repite ~864.
  - `accounts-receivable/accounts-receivable.service.spec.ts`: ~646 duplicado de ~513 (mismo nombre); orden por último movimiento (~321, ~336, ~561) dejar uno si son el mismo caso; ~486 si repite ~474.
- **S6** — Borrar completos (frontend): `lib/api-error.test.ts`, `pages/accounts-receivable/accounts-receivable.utils.test.ts`, `pages/documents/pos-checkout/CreditLimitPanels.test.tsx`.
- **S7** — Recortar (frontend), solo lo indicado:
  - `lib/format.test.ts`: casos de texto de fecha corta y guion "—" (~21-29); quedan los de día corrido.
  - `lib/password-rule.test.ts`: aserciones de etiquetas en español y del texto del mensaje (~6-8, ~33-36); queda la regla.
  - `lib/tax.test.ts`: el chequeo de la constante `=== 19` (~10-13).
  - `pages/documents/components/ProductRow.test.tsx`: ~101-104 (eco de prop) y ~125-133 (repite chequeo de etiqueta).
  - `pages/documents/components/available-stock.test.ts`: aserciones de textos exactos (~5-7, ~11-14, ~18-21); queda la decisión de aviso y `takesStockOut`.
  - `pages/documents/components/sale-price.test.ts`: ~10-14 (repite la constante).
  - `pages/documents/components/scan-queue.test.ts`: ~67-76 (secuencia del contador).
  - `pages/documents/pos-checkout/PaymentLinesField.test.tsx`: todo salvo ~39-46 (crédito solo en POS con cliente, no M2).
  - `pages/documents/pos-checkout/SaleCart.test.tsx`: ~96-103.
  - `pages/documents/pos-checkout/findMissingItems.test.ts`: ~70-101 (orden del mensaje).
  - `pages/documents/pos-checkout.utils.test.ts`: ~95-104, ~204-216, ~250-256, ~386-389.
  - `pages/third-parties/ThirdPartiesPage.test.tsx`: todo salvo ~91-103 (quién ve la columna de cupo).
- **S8** — Al recortar, si un test mezcla regla + texto, se quita solo la aserción de texto, no el test. Borrar imports/helpers que queden sin uso. No tocar código de producción.
- **S9** — Al final todo verde: backend `jest` + `tsc --noEmit -p tsconfig.json`; frontend `vitest run` + `tsc -b`/build. Reportar conteos antes/después y la lista de `it` eliminados.

## Tasks

- T1 — backend S2-S5, S8-S9 — worker — commit: f3fbf17 (71 suites / 733 tests, tsc ok)
- T2 — frontend S2-S3, S6-S8, S9 — worker — commit: 36757f8 (27 files / 221 tests, build ok)

## Log

- L1 — Dueño: "si mira, quioer que revises el codigo y hagamso un analsis de losa rchivos de prueba, polrque siento que hay pruebas que son inncesarisas ,e tnpocnes no le veo sentido a que todo lo que se haga tenga pruebas, es sdecir si es algo visual o infinmo pues no tienen sentidio, solamente deberia tener pruebas aquello que es critico, como los docuemntos, pagos, reibid dinero, ventas etc etc"
- L2 — Análisis con 2 exploradores; el padre corrigió: `documents.contract.spec.ts` se queda (CI tsc). Lista fija de document-permissions: recomendación del padre dejarla; el dueño no la objetó.
- L3 — Dueño: "dale" (plan completo: borrar + recortar, commit backend y frontend separados).
- L4 — Se quedaron contra la lista (S2): api-error (bug e08e426), PaymentLinesField reintentar (88c5065), findMissingItems (único test de bloqueos de venta, sin orden), ThirdPartiesPage columna con COT (1e0e37a), resolve-report-range fechas inexistentes, pdf-totals POSO, reports getSalesBySeller (conversión BigInt), duplicados aparentes de inventory-cases/recibos-caja/accounts-receivable (eran métodos/flujos distintos). find-all/find-one recortados, no borrados (filtro de activos). city.spec reemplazado por update-branch.spec: la sucursal solo se edita desde su cliente (mutación quitando `customerId` del where: DETECTADA).
