# Evidencia: egresos-recibos-mismo-diseno

## PR1 — reparto del saldo a favor en recibos (backend)

### Qué código revisar
| Nivel | Dónde | Regla | Qué se rompe si está mal |
|---|---|---|---|
| Alto | `backend/src/recibos-caja/recibos-caja.service.ts` (`create`, bloque "Reparto igual que egresos") | CxC más antigua primero, saldo más antiguo primero, sobre abono − descuento | Una factura figura pagada con saldo que no le corresponde |
| Alto | `backend/prisma/migrations/20261113150000_recibo_credit_split/migration.sql` | Unique (saldo, recibo, CxC) + CHECK `credit_amount <= amount` | Duplicados o saldo mayor que el abono |
| Medio | `recibos-caja.service.ts` `findAll` | `creditTotal` = Σ aplicaciones del recibo | Lista muestra saldo a favor equivocado |
| Medio | `contracts/recibos-caja.ts` | `creditAmount` null en recibos viejos | Recibos viejos muestran 0 en vez de "—" |

### Prueba de que las pruebas sirven
| Mutación | Resultado | Prueba |
|---|---|---|
| Sin `.sort` de saldos | DETECTADA (agente) | dos saldos consumen el más antiguo primero aunque lleguen desordenados |
| `amountCents` en vez de `amountCents − discountShareCents` | DETECTADA (agente y orquestador: 1 fallo) | con descuento, el saldo solo cubre lo que queda tras el descuento |
| Sin `creditTotal` en `findAll` | DETECTADA (agente) | calcula dinero recibido, saldo a favor y descuento |

Conteos (orquestador): backend `tsc --noEmit` 0 errores; jest 68 suites / 697 tests. Frontend `tsc` 0 errores.
Base real: migración aplicada (`_prisma_migrations`), índice único y CHECK verificados en el catálogo. Crear un recibo contra la base real: pendiente (prueba en pantalla del dueño).
