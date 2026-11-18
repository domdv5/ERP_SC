# Anular egreso — evidencia

Commits: ca1c5b8 (backend), efe0d3a (frontend). jest 723/723, vitest 247/247, tsc backend y frontend 0.

## Mutaciones (cada una restaurada; `git status` limpio al final)

| Mutación | Resultado | Prueba que la atrapó |
|---|---|---|
| M1: no restar el abono del egreso a `paidAmount` | DETECTADA (2 fallan) | `egresos.service.void.spec.ts` |
| M2: no devolver el saldo a favor usado | DETECTADA (1 falla) | `egresos.service.void.spec.ts` |
| M3: quitar el chequeo de doble anulación | DETECTADA (1 falla) | `egresos.service.void.spec.ts` |
| M4: el saldo a favor no vuelve a `available` | DETECTADA (1 falla) | `egresos.service.void.spec.ts` |
| M5: un egreso anulado sigue bloqueando anular la CM/DVC | DETECTADA (2 fallan) | `documents.service.void.egreso.spec.ts` |

Las pruebas son con mocks; la base real se probó por API (ver L5 en `anular-egreso.md`).
