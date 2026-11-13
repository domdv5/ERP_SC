# Cupo oculto por rol y montos borrables

Pendientes 1, 2 y 4 de `odd/backlog/pendientes-2026-11-12.md`. Dos PRs separados: PR1 backend (cupo), PR2 frontend (montos).

## Specs
- S1: `GET /third-parties`, `GET /third-parties/:id` y las respuestas de crear/editar tercero devuelven `customer.creditLimit` como `null` a quien no tenga `document.create.COT` ni `customer.credit.update` (misma regla de `third-parties/helpers/credit-visibility.ts`). Backlog: "Regla acordada: los demás roles no reciben el dato."
- S2: Un usuario sin permiso de cupo que edita un cliente con cupo no lo borra ni lo cambia al guardar.
- S3: Pendiente 4 se cierra en el backlog sin código: registrar o anular un excedente solo escribe `customer_credit`, no toca `AccountsReceivable`, así que no cambia el "Usado" del cupo.
- S4: Los campos de monto con `Controller` + `ThousandsInput` no vuelven al valor anterior al borrarlos: `ProductForm.tsx` (precio de venta, precio mínimo), `EgresoNewPage.tsx` (monto), `RecibosCajaNewPage.tsx` (monto, valor del descuento), `POSCartLine.tsx` (precio), `ProductRow.tsx` (costo, precio). Arreglo de referencia: `ThirdPartyForm.tsx` (`field.onChange(v ?? null)`).
- S5: Un campo obligatorio vaciado muestra error ("Requerido") y no se guarda como 0.

## Tasks
- T1 [S1,S2,S3] backend: ocultar cupo + pruebas + backlog — PR1 — commit: pendiente
- T2 [S4,S5] frontend: montos borrables sin guardar 0 + pruebas — PR2 — commit: pendiente

## Log
- L1 (2026-11-13): "de lo mas freecos, el 1 y el 2, el 4 no lo entenid" / "el 4 tambien incluyelo!" / "dale" (sobre el plan: PR1 cupo null por rol + cerrar 4 en backlog; PR2 `v ?? null` en 8 campos y vacío obligatorio = "Requerido", nunca 0).
- L2: Exploración del 4: excedentes solo escriben `customer_credit` (`excedentes.service.ts:38-50, :101-109`); "Usado" = suma de `totalAmount − paidAmount` de CxC pending/partial (`credit.helpers.ts:44-66`).
