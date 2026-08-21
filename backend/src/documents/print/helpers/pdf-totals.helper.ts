import { Prisma } from '@prisma/client';

/**
 * IVA fijo del 19% — excepción de presentación exclusiva del PDF impreso.
 * El dominio (Document/DocumentItem) no modela impuestos (ver comentario en
 * schema.prisma sobre fase 2 de facturación electrónica). No importar este
 * archivo fuera de documents/print/.
 */
export const PRINT_IVA_RATE = 0.19;

export interface PrintTotals {
  subtotal: number;
  iva: number;
  total: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** IVA de una sola línea — columna "V.IVA" de la tabla de ítems del PDF. */
export function computeItemIva(subtotal: Prisma.Decimal | number): number {
  return round2(Number(subtotal) * PRINT_IVA_RATE);
}

/** Totales agregados del documento — caja de totales del footer del PDF. */
export function computePrintTotals(
  items: { subtotal: Prisma.Decimal | number }[],
): PrintTotals {
  const subtotal = round2(
    items.reduce((sum, item) => sum + Number(item.subtotal), 0),
  );
  const iva = round2(subtotal * PRINT_IVA_RATE);

  return { subtotal, iva, total: round2(subtotal + iva) };
}
