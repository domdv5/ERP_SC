import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentMethod } from '@/common/enums';
import { formatCOP } from '@/documents/print/helpers/format.helper';

type Amount = number | string | Prisma.Decimal;

export type SalePayment = { method: PaymentMethod; amount: Amount };

/** Venta de contado: las formas de pago deben sumar exacto el total a cobrar (sin vuelto). */
export function assertPaymentsMatchTotal(
  payments: SalePayment[],
  amountToCollect: Amount,
) {
  const toCollect = new Prisma.Decimal(amountToCollect);

  if (payments.length === 0 && toCollect.gt(0)) {
    throw new BadRequestException(
      'La venta requiere al menos una forma de pago',
    );
  }

  if (payments.some((p) => new Prisma.Decimal(p.amount).lte(0))) {
    throw new BadRequestException(
      'Cada forma de pago debe tener un monto mayor a 0',
    );
  }

  if (new Set(payments.map((p) => p.method)).size !== payments.length) {
    throw new BadRequestException('No se puede repetir una forma de pago');
  }

  const paid = payments.reduce(
    (sum, p) => sum.plus(p.amount),
    new Prisma.Decimal(0),
  );
  if (paid.equals(toCollect)) return;

  const difference = formatCOP(paid.minus(toCollect).abs());
  throw new BadRequestException(
    `Las formas de pago suman ${formatCOP(paid)} y el total a cobrar es ${formatCOP(toCollect)}: ${
      paid.lt(toCollect) ? 'faltan' : 'sobran'
    } ${difference}`,
  );
}
