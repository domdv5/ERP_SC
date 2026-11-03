import { BadRequestException } from '@nestjs/common';
import { CustomerCreditUsableIn, DvvRefundMethod } from '@prisma/client';

/** Dónde se usa el saldo que genera una DVV; null si no genera saldo. */
export function resolveCreditUsableIn(
  refundMethod: DvvRefundMethod,
  creditUsableIn: CustomerCreditUsableIn | null | undefined,
): CustomerCreditUsableIn | null {
  if (refundMethod === DvvRefundMethod.devolucion_dinero) return null;
  // El saldo de un cambio existe para pagar la venta del producto nuevo.
  if (refundMethod === DvvRefundMethod.cambio_producto) {
    return CustomerCreditUsableIn.facturacion;
  }
  if (!creditUsableIn) {
    throw new BadRequestException(
      'Seleccione dónde se usará el saldo a favor: en facturación o en administración',
    );
  }
  return creditUsableIn;
}

/** Lo que se guarda en el borrador: el destino solo existe con saldo_a_favor. */
export function resolveStoredCreditUsableIn(
  refundMethod: DvvRefundMethod | null | undefined,
  creditUsableIn: CustomerCreditUsableIn | null | undefined,
): CustomerCreditUsableIn | null {
  return refundMethod === DvvRefundMethod.saldo_a_favor
    ? (creditUsableIn ?? null)
    : null;
}
