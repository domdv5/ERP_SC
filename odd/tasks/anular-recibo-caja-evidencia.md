# Anular recibo de caja — evidencia

## T1 backend (2026-11-25)

- jest 784/784 (77 suites), `tsc --noEmit` 0. Migración `20261125160000_recibo_caja_void` aplicada en la base local; seed corrido (`recibo.void` solo en admin y accounts_admin).
- Solo pruebas con prisma falso; la base real y la pantalla van en T3.

### Mutaciones (se rompe la regla, la prueba debe fallar, se restaura)

| # | Mutación | Resultado | Prueba que la atrapó |
|---|---|---|---|
| M1 | No restar el abono de la CxC | DETECTADA | void: S10, recibo posterior R2, 409 abono > pagado |
| M2 | No devolver el saldo a favor | DETECTADA | void: S10 |
| M3 | Estado `partial` en vez de `pending` con pagado 0 | DETECTADA | void: S10 |
| M4 | Sin reclamo atómico (`voidedAt: null`) | DETECTADA | void: S10, reasonOther null |
| M5 | Recibo anulado cuenta como vigente al anular la venta | DETECTADA | void recibo: COT con recibo anulado, DVV |
| M6 | Al anular la venta borra filas de recibos vigentes | DETECTADA | void recibo: COT, DVV |
| M7 | Historial de CxC cuenta recibos anulados | DETECTADA | AR: estado de cuenta, historial |
| M8 | Estado de cuenta cuenta saldos de recibos anulados | DETECTADA | AR: estado de cuenta |
| M9 | Excedente usado en recibo anulado no se puede anular | DETECTADA | Excedentes: void |
| M10 | Detalle de saldos cuenta recibos anulados | DETECTADA | Credits: detalle de cliente |
