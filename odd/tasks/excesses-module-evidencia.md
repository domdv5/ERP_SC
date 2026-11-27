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

## Qué no se probó
- La pantalla `/excesses` en el navegador.
- El uso de un excedente de cliente en un recibo de caja. Ese código no cambió, pero no se volvió a ejercitar.
