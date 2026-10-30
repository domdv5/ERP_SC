Saldo a favor por excedente de pago del cliente (rama `feat/saldo-favor-excedente`).
Se registra en el estado de cuenta y se usa solo en recibos de caja, por cliente + sucursal. Misma tabla `CustomerCredit` con `kind`.

## Specs

- S1 "puede pasar que el cleinte nos pague de mas ... eso se convierte en saldo favor del cliente ... la persona digita ese valor". Se registra con botón "Registrar excedente" en el estado de cuenta del cliente (+ atajo en el recibo): sucursal (si el cliente tiene), valor, fecha; quién y cuándo automáticos. Sin factura ni texto libre: "si es tecto libre puede inducir al errror".
- S2 "el tema de la tabla, me parece mas idenoe pro tipo no?": misma tabla `CustomerCredit` con tipo `devolucion` | `excedente`; el tipo lo pone el sistema, nunca un desplegable.
- S3 "4- solo recibos": el excedente solo se usa en recibos de caja; nunca al facturar (POS/COT). Filtro en backend, con prueba.
- S4 "El saldo a favor de un sucursal pertenece a esa sucursal solo se pueden aplciar a facturas de esa sucursar, juntos pero no revuletos ya que cada una manejka su propias ceuntas": excedente de sucursal A solo paga CxC de A; sin sucursal solo CxC sin sucursal.
- S5 "5- solo adminsitracion y el dmin": permiso `excedente.create` solo para `admin` y `accounts_admin`.
- S6 "si alguein por ejemplo registra 10.000.000 y era 7.000.000 poder anular el de 10 y crear el de 7 ? mientras que no se haya usado?": anular solo si nunca se usó; queda marcado anulado con quién y cuándo, no se borra.
- S7 "3 - El saldo por devolcuion es otro tema que no vamso a tocar": las reglas de saldo por DVV no cambian.
- S8 "6- no": el excedente nunca se devuelve en dinero.
- S9 Recibo: abonos = formas de pago + excedentes aplicados + descuento; no se aplica más que el saldo disponible; bloqueo de fila contra uso simultáneo.

## Tasks

- T1 S2,S5,S6 schema + migración (kind, sucursal, userId, anulación; aplicación a venta o recibo) + seed permiso — inline — commit: ecc7ff4 ✅
- T2 S1,S3,S5,S6,S7 backend registrar/anular excedente + filtro de facturación + pruebas — inline — commit: 1631153 ✅
- T3 S3,S4,S9 backend recibo con excedentes + pruebas — inline — commit: 4aaa70d ✅
- T4 S1,S4,S6,S9 frontend estado de cuenta, recibo y detalle — react-code-crafter — commit: f77f840 ✅
- T5 todas: verificación independiente + docs CLAUDE.md — commit: f77f840 + fix final ✅

## Log

- L1 (2026-10-30) "resulta que puede pasar que el cleinte nos pague de mas o nosotros pagar de mas,eso se convierte en saldo favor del cliente o de nosotrso y se puede usar en cuentas por apgar o cobrar, como podriamos inegrar eso a nivel de sistema obviament ela persona digita ese valor y se aplicaria en el recibo de caja o egreso"
- L2 "por ahora si factura porque un cliente lelga a tenr tatnas que es muy difical saber cual, ademas si es tecto libre puede inducir al errror"; "un excedente no esta ligado a que lo genreo un recibo de cja, simplemnte el cleinte apgo de mas y lsito"; registrar en estado de cuenta: "dale".
- L3 "1- clientes 2- son datos netamente de prueba 3 - El saldo por devolcuion es otro tema que no vamso a tocar porque hace falta aclarar unas cosas, este saldo a favor es difentes 4- solo recibos 5- solo adminsitracion y el dmin 6- no 7- El saldo a favor de un sucursal pertenece a esa sucursal solo se pueden aplciar a facturas de esa sucursar, juntos pero no revuletos ya que cada una manejka su propias ceuntas"
- L4 Tabla por tipo; roles admin + accounts_admin "si"; anular no usado "si"; migración + seed RBAC confirmados "si". "para arrancar".
- L5 Verificación: gentle-ai-verify S1-S9 pasan (migración revisada por lectura, aplicada en dev con CHECKs probados en tx revertida). Review nativa (risk, resilience, reliability) aprobada y reconocida (review-7bf6bcbef0f3106c). Corregidos: "Usar todo" ya no se pasa de la deuda; refresco recorta al saldo nuevo. Avisos para después: registrar excedente sin idempotencia (doble clic = dos excedentes; se corrige anulando), monto sin tope máximo.
