import { Prisma } from '@prisma/client';
import {
  computeItemIva,
  computePrintTotals,
  computeSalePrintTotals,
  computeSaleUnitValues,
  splitIncludedIva,
} from './pdf-totals.helper';

const toCents = (value: number) => Math.round(value * 100);

describe('computeItemIva', () => {
  it('19% de un subtotal: 100.000 → 19.000', () => {
    expect(computeItemIva(100000)).toBe(19000);
  });

  it('acepta un Prisma.Decimal: 50.000 → 9.500', () => {
    expect(computeItemIva(new Prisma.Decimal('50000'))).toBe(9500);
  });

  it('subtotal 0 da IVA 0', () => {
    expect(computeItemIva(0)).toBe(0);
  });
});

describe('splitIncludedIva', () => {
  it('separa el IVA incluido: 85.800 → base 72.100,84 + IVA 13.699,16', () => {
    expect(splitIncludedIva(85800)).toEqual({ base: 72100.84, iva: 13699.16 });
  });

  it('1.187.025 → base 997.500 + IVA 189.525 (división exacta)', () => {
    expect(splitIncludedIva(1187025)).toEqual({ base: 997500, iva: 189525 });
  });

  it('un total de $1 se separa en base 0,84 + IVA 0,16', () => {
    expect(splitIncludedIva(1)).toEqual({ base: 0.84, iva: 0.16 });
  });

  it('total 0 da base 0 e IVA 0', () => {
    expect(splitIncludedIva(0)).toEqual({ base: 0, iva: 0 });
  });

  it.each([1, 99, 14900, 85800, 1187025])(
    'base + IVA suman EXACTAMENTE el total (al centavo) para %d',
    (total) => {
      const { base, iva } = splitIncludedIva(total);

      expect(toCents(base) + toCents(iva)).toBe(toCents(total));
    },
  );
});

describe('computeSaleUnitValues', () => {
  it('venta normal (taxAmount null): el precio ya incluye IVA, se separa base e IVA', () => {
    const values = computeSaleUnitValues({
      quantity: 1,
      unitPrice: 85800,
      subtotal: 85800,
      taxAmount: null,
    });

    expect(values).toEqual({
      unit: 72100.84,
      unitIva: 13699.16,
      unitTotal: 85800,
      lineTotal: 85800,
    });
  });

  it('POSO: usa el taxAmount guardado y no recalcula (997.500 + 189.525)', () => {
    const values = computeSaleUnitValues({
      quantity: 1,
      unitPrice: new Prisma.Decimal('997500'),
      subtotal: new Prisma.Decimal('997500'),
      taxAmount: new Prisma.Decimal('189525'),
    });

    expect(values).toEqual({
      unit: 997500,
      unitIva: 189525,
      unitTotal: 1187025,
      lineTotal: 1187025,
    });
  });

  it('POSO con 2 unidades: el IVA unitario es taxAmount / cantidad', () => {
    const values = computeSaleUnitValues({
      quantity: 2,
      unitPrice: 10000,
      subtotal: 20000,
      taxAmount: 3800,
    });

    expect(values).toEqual({
      unit: 10000,
      unitIva: 1900,
      unitTotal: 11900,
      lineTotal: 23800,
    });
  });

  it('POSO usa el taxAmount guardado aunque no sea el 19% exacto', () => {
    const values = computeSaleUnitValues({
      quantity: 1,
      unitPrice: 10000,
      subtotal: 10000,
      taxAmount: 1500,
    });

    expect(values.unitIva).toBe(1500);
    expect(values.lineTotal).toBe(11500);
  });
});

describe('computeSalePrintTotals', () => {
  it('venta con IVA incluido: total 85.800 → subtotal 72.100,84 + IVA 13.699,16', () => {
    const totals = computeSalePrintTotals([
      { quantity: 1, unitPrice: 85800, subtotal: 85800, taxAmount: null },
    ]);

    expect(totals).toEqual({ subtotal: 72100.84, iva: 13699.16, total: 85800 });
  });

  it('el total es la suma de las líneas y se separa una sola vez (no línea por línea)', () => {
    const totals = computeSalePrintTotals([
      { quantity: 1, unitPrice: 40000, subtotal: 40000, taxAmount: null },
      { quantity: 1, unitPrice: 45800, subtotal: 45800, taxAmount: null },
    ]);

    expect(totals).toEqual({ subtotal: 72100.84, iva: 13699.16, total: 85800 });
  });

  it('en venta con IVA incluido subtotal + IVA suman exacto el total', () => {
    const totals = computeSalePrintTotals([
      { quantity: 1, unitPrice: 14900, subtotal: 14900, taxAmount: null },
      { quantity: 1, unitPrice: 99, subtotal: 99, taxAmount: null },
    ]);

    expect(toCents(totals.subtotal) + toCents(totals.iva)).toBe(
      toCents(totals.total),
    );
    expect(totals.total).toBe(14999);
  });

  it('POSO (todas las líneas con taxAmount): 997.500 + 189.525 = 1.187.025', () => {
    const totals = computeSalePrintTotals([
      {
        quantity: 1,
        unitPrice: 997500,
        subtotal: 997500,
        taxAmount: 189525,
      },
    ]);

    expect(totals).toEqual({
      subtotal: 997500,
      iva: 189525,
      total: 1187025,
    });
  });

  it('sin ítems devuelve todo en 0', () => {
    expect(computeSalePrintTotals([])).toEqual({
      subtotal: 0,
      iva: 0,
      total: 0,
    });
  });
});

describe('computePrintTotals (compras: el IVA se SUMA)', () => {
  it('compra de 100.000: IVA 19.000 y total 119.000', () => {
    const totals = computePrintTotals([{ subtotal: 100000 }]);

    expect(totals).toEqual({ subtotal: 100000, iva: 19000, total: 119000 });
  });

  it('suma varias líneas antes de calcular el IVA', () => {
    const totals = computePrintTotals([
      { subtotal: new Prisma.Decimal('30000') },
      { subtotal: new Prisma.Decimal('70000') },
    ]);

    expect(totals).toEqual({ subtotal: 100000, iva: 19000, total: 119000 });
  });

  it('sin ítems devuelve todo en 0', () => {
    expect(computePrintTotals([])).toEqual({ subtotal: 0, iva: 0, total: 0 });
  });
});
