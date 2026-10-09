import { Prisma } from '@prisma/client';

/** IVA fijo del 19% — excepción de presentación solo del PDF; el dominio no modela impuestos (ver schema.prisma, fase 2 de facturación electrónica). No importar fuera de documents/print/. */
export const PRINT_IVA_RATE = 0.19;

export interface PrintTotals {
  subtotal: number;
  iva: number;
  total: number;
}

function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/** IVA de una sola línea — columna "V.IVA" de la tabla de ítems del PDF. */
export function computeItemIva(subtotal: Prisma.Decimal | number): number {
  return roundTo2Decimals(Number(subtotal) * PRINT_IVA_RATE);
}

export interface SaleUnitValues {
  unit: number;
  unitIva: number;
  unitTotal: number;
  lineTotal: number;
}

interface SaleItem {
  quantity: number;
  unitPrice: Prisma.Decimal | number;
  subtotal: Prisma.Decimal | number;
  taxAmount: Prisma.Decimal | number | null;
}

/** Separa un valor con IVA incluido: base + IVA suman exactamente el total. */
export function splitIncludedIva(total: number): { base: number; iva: number } {
  const base = roundTo2Decimals(total / (1 + PRINT_IVA_RATE));
  return { base, iva: roundTo2Decimals(total - base) };
}

/** Ventas normales: el precio ya incluye IVA. POSO: precio sin IVA y taxAmount guardado por línea. */
export function computeSaleUnitValues(item: SaleItem): SaleUnitValues {
  if (item.taxAmount !== null) {
    const unit = Number(item.unitPrice);
    const unitIva = roundTo2Decimals(Number(item.taxAmount) / item.quantity);

    return {
      unit,
      unitIva,
      unitTotal: roundTo2Decimals(unit + unitIva),
      lineTotal: roundTo2Decimals(
        Number(item.subtotal) + Number(item.taxAmount),
      ),
    };
  }

  const unitTotal = Number(item.unitPrice);
  const { base, iva } = splitIncludedIva(unitTotal);

  return {
    unit: base,
    unitIva: iva,
    unitTotal,
    lineTotal: roundTo2Decimals(Number(item.subtotal)),
  };
}

/** Totales de venta: total cobrado = Σ líneas; POSO usa el IVA guardado, el resto lo separa del total. */
export function computeSalePrintTotals(items: SaleItem[]): PrintTotals {
  if (items.length > 0 && items.every((item) => item.taxAmount !== null)) {
    const subtotal = roundTo2Decimals(
      items.reduce((sum, item) => sum + Number(item.subtotal), 0),
    );
    const iva = roundTo2Decimals(
      items.reduce((sum, item) => sum + Number(item.taxAmount), 0),
    );

    return { subtotal, iva, total: roundTo2Decimals(subtotal + iva) };
  }

  const total = roundTo2Decimals(
    items.reduce((sum, item) => sum + Number(item.subtotal), 0),
  );
  const { base, iva } = splitIncludedIva(total);

  return { subtotal: base, iva, total };
}

/** Totales agregados del documento — caja de totales del footer del PDF. */
export function computePrintTotals(
  items: { subtotal: Prisma.Decimal | number }[],
): PrintTotals {
  const subtotal = roundTo2Decimals(
    items.reduce((sum, item) => sum + Number(item.subtotal), 0),
  );
  const iva = roundTo2Decimals(subtotal * PRINT_IVA_RATE);

  return { subtotal, iva, total: roundTo2Decimals(subtotal + iva) };
}
