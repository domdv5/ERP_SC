# Evidencia — Columna "Cupo" en Terceros (2026-11-12)

Pedido (L1): "primero que todo me hace falta una forma rapida de conmsultar el credito de un cliente , cuanto es, cunato a usado y cuando le falta, no me doy cuenta hasta que hago una cot" · "dale, cartera tambione lo ve".
Regla (rediseño tras feedback "no me gusto como queod… si yo busco al lciente… no me aprece anda"): tres columnas planas Cupo / Usado / Disponible, en cualquier filtro o búsqueda si la página tiene clientes, solo para quien puede hacer COT o fijar cupos (Facturación, Líder, Admin, Cartera). A los demás el backend no les manda el dato.

## Qué código revisar

| Nivel | Dónde | Qué pasa si está mal |
|---|---|---|
| Alto | `backend/src/documents/helpers/credit.helpers.ts` `getCreditLimitSummaries` | Cupo usado distinto al de la COT: el cajero ve un número y la COT otro (la COT ahora usa esta misma función) |
| Alto | `backend/src/third-parties/helpers/credit-visibility.ts` | Bodega/Compras/Preventa verían el cupo y la deuda de los clientes |
| Medio | `backend/src/third-parties/third-parties.service.ts` `findAll` | Cupo pegado al cliente equivocado o enviado sin permiso |
| Bajo | `frontend/src/pages/third-parties/ThirdPartiesPage.tsx` | Columna visible donde no va (el dato igual no llega sin permiso) |

## Mutaciones (rompo la regla → la prueba debe fallar → restauro, `git diff` vacío)

| # | Mutación | Resultado |
|---|---|---|
| M1 | (obsoleta: el filtro Clientes ya no es parte de la regla) | — |
| M2 | Cualquier permiso ve el cupo | DETECTADA |
| M3 | El service manda el cupo sin chequear la regla | DETECTADA |
| M4 | Cupo usado ignora abonos (`paidAmount`) | DETECTADA |
| M5 | Cupo usado mezcla clientes | DETECTADA |
| M6 | Pantalla muestra Cupo sin permiso | DETECTADA |
| M7 | Pantalla muestra columnas aunque la página no tenga clientes | DETECTADA (re-corrida tras rediseño, igual M2-M6) |

## Contra la base real (API local, no mocks)

- Paridad con la COT: 10 clientes de la lista, los 10 con `creditLimit/usedCredit/availableCredit` idénticos a `GET /documents/customers/:id/credit`.
- Sin filtro Clientes (admin): 0 filas con `credit`.
- Usuario de prueba `cupo_bodega` (rol warehouse): 10 clientes, 0 con `credit`.
- Usuario de prueba `cupo_cartera` (rol accounts_admin): 10 clientes, 10 con `credit`.

- Tras el rediseño, búsqueda "prueba" sin filtro: admin 6/6 clientes con `credit`, `cupo_cartera` 6/6, `cupo_bodega` 0/6; filtro Proveedores: 0 con `credit` para todos.

## Qué solo se probó con mocks

- La pantalla (columna, rojo, "—") solo con pruebas de componente; no se vio en el navegador.
