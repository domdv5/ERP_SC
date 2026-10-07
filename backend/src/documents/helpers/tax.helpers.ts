import { Prisma } from '@prisma/client';
import { DocumentType } from '@/common/enums';

/** Tipos cuyo valor digitado va sin IVA y el sistema guarda el IVA aparte. */
export const OFFICIAL_TAX_TYPES: ReadonlySet<DocumentType> = new Set([
  DocumentType.CMO,
  DocumentType.POSO,
]);

const OFFICIAL_TAX_RATE = new Prisma.Decimal('0.19');

const roundMoney = (value: Prisma.Decimal) =>
  value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

/** Subtotal (cantidad × valor sin IVA) e IVA 19% de una línea, redondeados a 2 decimales. */
export function computeOfficialLine(quantity: number, unitValue: number) {
  const subtotal = roundMoney(new Prisma.Decimal(unitValue).mul(quantity));
  const taxAmount = roundMoney(subtotal.mul(OFFICIAL_TAX_RATE));
  return { subtotal, taxAmount };
}

/** Piso de precio sin IVA: minSalePrice ya trae IVA, así que en POSO se compara contra minSalePrice / 1,19. */
export function officialNetFloor(minSalePriceWithTax: number | Prisma.Decimal) {
  return new Prisma.Decimal(minSalePriceWithTax)
    .div(OFFICIAL_TAX_RATE.plus(1))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_UP)
    .toNumber();
}

/** Totales del documento a partir de las líneas: total = Σ subtotal + Σ IVA. */
export function sumOfficialLines(
  lines: { subtotal: Prisma.Decimal; taxAmount: Prisma.Decimal }[],
) {
  const subtotal = lines.reduce(
    (sum, l) => sum.plus(l.subtotal),
    new Prisma.Decimal(0),
  );
  const taxTotal = lines.reduce(
    (sum, l) => sum.plus(l.taxAmount),
    new Prisma.Decimal(0),
  );
  return { taxTotal, total: subtotal.plus(taxTotal) };
}
