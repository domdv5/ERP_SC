# Recibos de caja: descuento y excedentes (pendiente, 2026-10-30)

Dos mejoras pedidas por el usuario. Ninguna está implementada: faltan respuestas de la empresa. Se implementan por separado, cada una en su rama.

## 1. Descuento en recibo de caja

Pedido: un check **"Descuento"** en el recibo. Al marcarlo aparecen un desplegable de motivo y un campo para el valor numérico. El descuento reduce lo que se debe recibir. Tiene que quedar trazado cuál era la deuda original, cuándo se hizo el descuento y cuánto se debió recibir.

Motivos: Descuento Comercial, Oferta, Donación, Fidelización, Mercancía Extraviada, Castigo de Cartera, Promoción.

Decidido (todo cerrado, listo para implementar):
- Los motivos son una lista fija en el sistema (enum).
- Migración Prisma confirmada.
- Regla nueva: abonos a facturas = pagado + descuento.
- El descuento solo se aplica cuando el recibo salda **completas** todas las facturas que abona; no hay descuento en abonos parciales, así que no hay reparto que decidir. Internamente se guarda la porción por factura solo para que el historial de cada una cuadre.
- Solo **Castigo de Cartera** y **Mercancía Extraviada** pueden cubrir el 100% de la deuda (recibo con $0 recibido). Con los demás motivos el descuento debe ser menor que la deuda y el resto se paga con dinero.

## 2. Excedentes → saldo a favor

Pedido: a veces el cliente nos paga de más, o nosotros le pagamos de más al proveedor. Lo detectan después, por ejemplo al revisar el banco. Ese excedente queda como saldo a favor y se cruza contra cualquier deuda del mismo cliente y de la misma sucursal.

Decidido:
- El excedente **no** está ligado a una factura (un cliente tiene demasiadas para saber cuál) ni a un recibo, y **no** lleva texto libre (induce errores).
- Se **registra primero** como saldo a favor y **se usa después**, con control del saldo disponible.
- Dónde se registra: botón **"Registrar excedente"** en el estado de cuenta del cliente (Cuentas por cobrar → cliente), con un modal: sucursal (si el cliente tiene), valor y fecha; quién lo registró y cuándo quedan automáticos. Atajo **"+ Registrar excedente"** en el bloque de saldos a favor del recibo de caja. El estado de cuenta muestra "Saldo a favor" por origen y el historial de excedentes.
- Dónde se usa: en el recibo de caja, bloque **"Saldos a favor disponibles"** del cliente y la sucursal, cada uno con su origen (`DVV-…` o excedente). Cuenta como pago; si cubre todo, el recibo puede quedar en $0 de plata.
- Un cliente puede usar en el mismo recibo saldos de **devolución en venta (DVV) y de excedente** juntos. Obligatorio.
- El saldo de una DVV hereda la sucursal de la DVV (`Document.customerBranchId` ya existe).
- Proveedores: lo mismo en el estado de cuenta de Cuentas por pagar y en el egreso. El cruce de saldos a favor en el egreso ya existe.

Cambios técnicos previstos: a `CustomerCredit` se le agrega sucursal y origen "excedente" (hoy solo nace de una DVV). La aplicación del saldo pasa a poder ser contra una CxC en un recibo (hoy `CustomerCreditApplication` se ancla solo a una venta). Lo mismo para `SupplierCredit`. Requiere migración.

Preguntas abiertas:
- [ ] Alcance: a) primero clientes y proveedores después (recomendado); b) ambos juntos.
- [ ] Saldos de DVV que ya existen sin sucursal: a) son de prueba, regla estricta: solo se usan en recibos sin sucursal (recomendado); b) se pueden usar en cualquier sucursal del cliente.
- [ ] Saldos de DVV: a) se siguen usando al facturar (POS/COT) y además en recibos (recomendado); b) solo en recibos.
- [ ] Excedentes: a) solo en recibos de caja (recomendado); b) también al facturar en POS/COT.

Relacionado: la regla "saldos a favor por origen (contado vs crédito)" sigue en espera de la empresa (Engram `customer-credit/origin-rule`). Conviene cerrarla junto con estas preguntas.

Notas:
- Hoy los recibos y egresos no se pueden anular. Si algún día se puede, un saldo a favor ya usado no se puede deshacer.
- No permitir descuento y excedente en el mismo recibo (propuesta, sin confirmar).
