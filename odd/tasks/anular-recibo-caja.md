# Anular recibo de caja

Anular un recibo de caja revierte exactamente lo que hizo (abonos a CxC, descuento y saldos a favor usados) y deja registro de quién, cuándo y por qué. Copia de `odd/tasks/anular-egreso.md` del lado del cliente.
Rama `feat/anular-recibo-caja`. Toca dinero (CxC, saldos a favor), una migración aditiva y el seed RBAC (ambos confirmados por el dueño, L4).

## Specs

- **S1** — Reversión de CxC: a cada cuenta por cobrar abonada se le resta exactamente `ReciboCajaAllocation.amount` de ese recibo (pago + descuento + saldo a favor) de `paidAmount`; los abonos de otros recibos se respetan. `status` se recalcula: `pending` si `paidAmount = 0`, `partial` si `0 < paidAmount < totalAmount`, `paid` si llega al total.
- **S2** — Reversión de saldos a favor: a cada `CustomerCredit` usado se le devuelve exactamente lo aplicado por ese recibo (`CustomerCreditApplication.amount`) a `balance`, y vuelve a `available`.
- **S3** — Registro: el recibo no se borra; queda anulado con `voidedAt`, `voidedById`, `voidReason` (obligatorio). Se sigue viendo en lista y detalle marcado "Anulado". El consecutivo no se reutiliza.
- **S4** — Sin límite de tiempo para anular.
- **S5** — Permiso nuevo `recibo.void`, para `admin` y `accounts_admin` (Admin. de Cuentas). Sin permiso → 403.
- **S6** — No se puede anular dos veces (incluido concurrente): el segundo intento falla con 409 y no cambia nada.
- **S7** — Motivo de lista fija: `valor_equivocado` (Valor equivocado), `cliente_equivocado` (Cliente equivocado), `factura_equivocada` (Factura equivocada), `forma_pago_equivocada` (Forma de pago equivocada), `pago_duplicado` (Pago duplicado), `pago_no_recibido` (Pago no recibido), `otro` (Otro). Con `otro` el texto es obligatorio (máx. 500): 400 'Escribe el motivo de la anulación'. Motivo fuera de la lista → 400.
- **S8** — Desbloqueos y lecturas: la regla que impide anular una venta (POS/COT) por tener cobros/recibos aplicados no cuenta recibos anulados; las lecturas de CxC (estado de cuenta, historial, último pago, saldo aplicado) y la regla de anular excedente "solo si no se usó" ignoran recibos anulados. Los listados de CxC siguen cuadrando (usan `paidAmount`/`status`, que se restauran).
- **S9** — Pantalla: botón "Anular" en el detalle del recibo (solo con `recibo.void`, oculto si ya está anulado) con diálogo de motivo (lista desplegable + texto si "Otro"); banner "Anulado por X el día Y — Motivo: …"; en la lista la fila se marca "Anulado". El texto de confirmación advierte en lenguaje simple que anular no devuelve el dinero (el sistema no lleva caja).
- **S10** — Ejemplo (debe cumplirse literal): cliente con COT-10 por 100.000 y COT-11 por 50.000; un recibo las paga con 120.000 en formas de pago + 20.000 de saldo a favor + 10.000 de descuento (ambas quedan pagadas, saldo usado). Al anular: COT-10 debe 100.000 y COT-11 debe 50.000, ambas `pending`; el saldo a favor vuelve a 20.000 `available`. Variante: si un recibo posterior R2 pagó el resto de una factura que R1 abonó parcialmente, anular solo R1 deja esa factura `partial` con lo de R2.

## Tasks

- [x] **T1** (S1-S8) backend: migración aditiva + enum, permiso seed, `POST /recibos-caja/:id/void`, DTO, contrato, desbloqueos y filtros de lecturas, pruebas de dinero — route: reversión (S1, S2, S6) parent; resto `nestjs-code-crafter` — commit: de840eb (slice 1, ~864 líneas, mayoría pruebas; el frontend va en su propio commit)
- [ ] **T2** (S3, S7, S9) frontend: botón, diálogo con motivo, banner, marca en lista — route `react-code-crafter` — commit: —
- [ ] **T3** (S10) verificación con base real y pantalla + docs CLAUDE.md — route parent — evidencia: —

## Log

- **L1** (2026-11-25) Pedido original: "actualemnte quiero que exploires que docuemntos se puden anualr, cuals no dberia poderser, y cuales ahce fatla" — la exploración marcó como hueco crítico que el recibo de caja no se puede anular (y bloquea anular la venta con cobros).
- **L2** Pregunta del dueño: "y que pasria etnonces si se puede anualr recibos de caja? que se revertira de punt a punta?" — se explicó con el ejemplo de S10.
- **L3** Decisión del dueño: "que sea tal cual como esta en egresos entonces!" → quién anula, motivo de lista, sin límite de tiempo y reversión igual que egresos. Motivos adaptados al cliente: proveedor_equivocado → cliente_equivocado, pago_no_realizado → pago_no_recibido.
- **L4** Plan presentado (S1-S10, T1-T3, migración aditiva y permiso `recibo.void` en el seed); el dueño respondió "dale".
- **L5** T1: jest 784/784, tsc 0, migración aplicada y seed corrido; 10 mutaciones detectadas (ver anular-recibo-caja-evidencia.md). Decisión heredada de egresos: anular una venta cuyo recibo ya está anulado borra las líneas de ese recibo anulado (FK); la cabecera queda.
