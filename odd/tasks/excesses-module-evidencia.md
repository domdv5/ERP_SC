# Evidencia — módulo de excedentes (2026-11-27)

## Conteos
- Backend `npx tsc --noEmit`: sin errores. `npx jest`: 80 suites, 838 pruebas, todas pasan.
- Frontend `npx tsc -b`: sin errores. `npx vitest run`: 31 archivos, 251 pruebas, todas pasan. `vite build`: ok.
- Migración `20261127120000_excesses_module` aplicada en dev; `prisma migrate diff` vacío (sin contar los índices trigram aceptados).

## E2E contra la API de desarrollo (admin, base dev)
Las 25 verificaciones pasaron:
- S2: cuando el tercero no tiene el rol, responde 404 «Cliente no encontrado» o «Proveedor no encontrado».
- S7: una sucursal de otro cliente da 400 y una sucursal en un proveedor también da 400.
- S4: una fecha futura da 400 y el valor 0 da 400.
- Ningún rechazo crea registros: los totales de la lista no cambian.
- S8: la ruta vieja `POST /accounts-receivable/clients/:id/excedentes` responde 404.
- S1/S9: se crean excedentes de cliente (con sucursal) y de proveedor, con número consecutivo compartido.
- S7: el egreso del proveedor ofrece su excedente y el egreso de otro proveedor no lo ve.
- S6: el uso parcial da 400; el uso completo crea el egreso y el excedente queda Usado con su EG.
- S3: un excedente usado no se anula. Al anular el egreso vuelve a Disponible. «Otro» sin texto da 400.
- S3: la anulación guarda el motivo con el texto recortado. Un excedente anulado no se ofrece en egresos y no se puede volver a anular.
- S3: se anula un excedente de cliente con motivo de lista. El id de un proveedor en la ruta de cliente responde 404.

## Mutaciones (`backend/src/excesses/excesses.service.ts`, prueba: `excesses.service.spec.ts`)
| Mutación | Resultado |
|---|---|
| M1 quitar la exigencia de rol cliente | DETECTADA |
| M2 quitar la exigencia de rol proveedor | DETECTADA |
| M3 aceptar una sucursal de otro cliente | DETECTADA |
| M4 ignorar los usos vigentes al anular | DETECTADA |
| M5 ignorar un saldo que ya bajó al anular | DETECTADA |
| M6 permitir reanular un anulado | DETECTADA |
| M7 aceptar una fecha futura | DETECTADA |
| M8 usar un consecutivo equivocado | DETECTADA |
| M9 perder la sucursal al guardar | DETECTADA |

El archivo quedó restaurado después de cada mutación (`cmp` idéntico).

## Corrección después de la verificación
- El listado repetía el mismo RC o EG cuando un pago repartía el excedente en varias cuentas. Se arregló con `uniqueById` y una prueba RED→GREEN (commit dc62549). Ahora jest da 839/839.

## Verificador independiente (gentle-ai-verify)
- S1 a S10 PASS. Sin blockers. La revisión nativa no corrió porque el cambio supera el presupuesto de contexto (`lens_context_budget_exceeded`).

## Pantalla (Playwright contra dev)
Pasaron todas:
- Al elegir un cliente con sucursales aparece el selector de sucursal, y si no se elige una sale «Selecciona una sucursal».
- Se registra el excedente: toast, y aparece en la lista como Disponible con su EXC.
- Al anular, el botón queda deshabilitado sin motivo, y con «Otro» sin texto no deja anular.
- Queda Anulado con su motivo.
- La pestaña Proveedores muestra sus EXC.

## Qué no se probó
- Pantalla angosta (menos de xl).
- Que el formulario de egreso abierto se refresque solo después de registrar un excedente; la consulta de open-items no se invalida.
- El uso de un excedente de cliente en un recibo de caja. Ese código no cambió, pero no se volvió a ejercitar.

## T6 — Hallazgos 1 a 6 de Judgment Day
- Conteos:
  - backend: `tsc` sin errores y jest 865/865;
  - frontend: `tsc` sin errores, vitest 259/259 y el build compila.
- Migración `20261127140000_excess_idempotency` aplicada. `migrate diff` solo muestra los índices trigram, que son una diferencia ya aceptada.
- E2E contra la API, 9/9 PASS:
  - un reintento con la misma clave devuelve el mismo excedente y no crea otro;
  - la misma clave con otro valor da 409;
  - registrar sin clave da 400;
  - buscar "EXC-000012", "EXC 000012" y "000012" encuentra el excedente;
  - el egreso recibe el tipo, el número y la fecha del excedente.
- Pantalla (Playwright), 4/4 PASS:
  - al pasar a la pestaña Proveedores, el panel cambia a Proveedor;
  - registrar desde la pantalla da 201, así que la clave se manda bien;
  - el excedente aparece como Disponible y se anula.
- Mutaciones:

| Mutación | Resultado |
|---|---|
| I1 ignorar una clave ya usada | DETECTADA |
| I2 no comparar el valor | DETECTADA |
| I3 no comparar el tercero | DETECTADA |
| I4 no comparar la sucursal | DETECTADA |
| I5 no buscar la clave en proveedores | DETECTADA |
| I6 en una carrera, responder error | DETECTADA |
| I7 no quitar el prefijo EXC al buscar | DETECTADA |
| F1 registrar mientras cargan las sucursales (frontend) | DETECTADA |

- Qué no se probó:
  - la carrera real P2002 en Postgres (solo con mocks);
  - el texto "Excedente EXC-…" dentro de la pantalla del egreso (solo pruebas unitarias del helper);
  - el recibo de caja: el backend ya manda `number`, pero la pantalla del recibo todavía no lo muestra.
