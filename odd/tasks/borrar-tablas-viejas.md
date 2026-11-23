# Borrar tablas y campos sin uso

Quitar del schema lo que el sistema ya no usa: los abonos viejos (anteriores a Recibos de Caja y Egresos), la tabla de equivalencias y la fecha de vencimiento de CxC/CxP. Rama `chore/borrar-tablas-viejas`. Una migración con el workaround manual de `backend/CLAUDE.md` (líneas 9-12); nunca `migrate reset` ni `db push --force-reset`.

## Specs

- **S1** — Borrar los modelos `ReceivablePayment` (`receivable_payments`) y `PayablePayment` (`payable_payments`) y sus relaciones (`AccountsReceivable.receivablePayments`, `AccountsPayable.payablePayments`). Se reemplazaron por Recibos de Caja (`f318ede`) y Egresos (`4da74fa`); la base local tiene 2 y 3 filas de prueba.
- **S2** — Borrar el modelo `EquivalenceTable` y su relación en `ThirdParty` (0 usos en `src` y `frontend`).
- **S3** — Borrar `dueDate` (`due_date`) de `AccountsReceivable` y `AccountsPayable`, con sus índices. Nunca se llena.
- **S4** — Contratos (`backend/src/contracts/`): quitar `dueDate` de `accounts-receivable.ts`, `accounts-payable.ts`, `egresos.ts` (2 lugares) y `recibos-caja.ts` (2 lugares); quitar la variante `source: 'pago_historico'` de `AccountsReceivableHistoryEntry` y `AccountsPayableHistoryEntry`. Backend y frontend los cumplen en el mismo PR.
- **S5** — Backend: quitar las lecturas de los abonos viejos en `accounts-receivable.service.ts`, `accounts-payable.service.ts` (historial, fecha del último abono, sumas), `documents/document-void.service.ts` (líneas ~81, ~120, ~265-290) y `documents/strategies/document-effect.strategy.ts` (~26, ~32). La regla de anulación queda igual con lo que existe: no se anula una venta/compra cuya CxC/CxP tenga abonos de recibo/egreso o saldos aplicados. Ajustar las pruebas existentes que mockean esas relaciones; no agregar pruebas de texto.
- **S6** — Frontend: en `AccountsReceivableDetailPage.tsx` y `AccountsPayableDetailPage.tsx` quitar el campo de vencimiento y la rama que pinta `pago_historico`; el texto vacío del historial deja de mencionar "movimientos históricos". Usar `BackLink`/patrones existentes, sin rediseñar.
- **S7** — La migración solo hace DROP de lo de S1-S3; quitar del SQL generado todo lo demás (ej. los índices trigram aceptados como drift). Las CxC/CxP locales que tenían esos 5 abonos viejos quedan con `paid_amount` que ya no tiene detalle: es dato de prueba, no se corrige.
- **S8** — Verificación: `migrate deploy` local, `prisma generate`, backend `jest` + `tsc --noEmit -p tsconfig.json`, frontend `vitest run` + `pnpm run build`. Actualizar `backend/CLAUDE.md` / `frontend/CLAUDE.md` donde mencionen estas tablas o el vencimiento.

## Tasks

- T1 — backend S1-S5, S7-S8 — nestjs-code-crafter (cortado por cuota; terminado por el padre: docs) — commit: ver PR (jest 738, tsc ok)
- T2 — frontend S4 (consumo), S6, S8 — react-code-crafter — commit: ver PR (vitest 221, build ok)

## Log

- L1 — Dueño: "entonces borras esa tablas, junto a al de euivalencia y el dudate"
- L2 — Dueño, sobre quitar la línea "Pago histórico" del historial: "continua entonces".
- L3 — Verify independiente: S1-S8 cumplidos, sin bloqueantes; regla de anulación intacta en pre-check y re-check (document-void.service.ts:79-83, 117-119, 260-275, 283-286).
