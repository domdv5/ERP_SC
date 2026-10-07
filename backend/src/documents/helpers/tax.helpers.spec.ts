import { Prisma } from '@prisma/client';
import { DocumentType } from '@/common/enums';
import {
  OFFICIAL_TAX_TYPES,
  computeOfficialLine,
  officialNetFloor,
  sumOfficialLines,
} from './tax.helpers';

describe('OFFICIAL_TAX_TYPES', () => {
  it('incluye solo CMO y POSO (los documentos que digitan el valor sin IVA)', () => {
    expect(OFFICIAL_TAX_TYPES.has(DocumentType.CMO)).toBe(true);
    expect(OFFICIAL_TAX_TYPES.has(DocumentType.POSO)).toBe(true);
    expect(OFFICIAL_TAX_TYPES.size).toBe(2);
  });

  it('no incluye CM ni POS: esos documentos no guardan IVA aparte', () => {
    expect(OFFICIAL_TAX_TYPES.has(DocumentType.CM)).toBe(false);
    expect(OFFICIAL_TAX_TYPES.has(DocumentType.POS)).toBe(false);
  });
});

describe('computeOfficialLine', () => {
  it('3 unidades de $10.000 sin IVA: subtotal 30.000 e IVA 5.700', () => {
    const { subtotal, taxAmount } = computeOfficialLine(3, 10000);

    expect(subtotal.toString()).toBe('30000');
    expect(taxAmount.toString()).toBe('5700');
  });

  it('997.500 sin IVA: IVA 189.525 (ejemplo real de POSO)', () => {
    const { subtotal, taxAmount } = computeOfficialLine(1, 997500);

    expect(subtotal.toString()).toBe('997500');
    expect(taxAmount.toString()).toBe('189525');
  });

  it('redondea el IVA hacia arriba cuando cae justo en medio centavo: 2,50 × 19% = 0,475 → 0,48', () => {
    const { taxAmount } = computeOfficialLine(1, 2.5);

    expect(taxAmount.toString()).toBe('0.48');
  });

  it('redondea el subtotal a 2 decimales con mitad hacia arriba: 33,335 → 33,34', () => {
    const { subtotal, taxAmount } = computeOfficialLine(1, 33.335);

    expect(subtotal.toString()).toBe('33.34');
    // El IVA se calcula sobre el subtotal ya redondeado: 33,34 × 0,19 = 6,3346 → 6,33
    expect(taxAmount.toString()).toBe('6.33');
  });

  it('con cantidad 0 el subtotal y el IVA son 0', () => {
    const { subtotal, taxAmount } = computeOfficialLine(0, 50000);

    expect(subtotal.toString()).toBe('0');
    expect(taxAmount.toString()).toBe('0');
  });

  it('con valor unitario 0 el subtotal y el IVA son 0', () => {
    const { subtotal, taxAmount } = computeOfficialLine(5, 0);

    expect(subtotal.toString()).toBe('0');
    expect(taxAmount.toString()).toBe('0');
  });
});

describe('officialNetFloor', () => {
  it('quita el IVA del precio mínimo cuando la división es exacta: 119.000 → 100.000', () => {
    expect(officialNetFloor(119000)).toBe(100000);
  });

  it('redondea HACIA ARRIBA para no dejar vender por debajo del mínimo: 100 / 1,19 = 84,0336 → 84,04', () => {
    expect(officialNetFloor(100)).toBe(84.04);
  });

  it('el piso redondeado hacia arriba nunca queda debajo del mínimo al volver a sumarle IVA', () => {
    const floor = officialNetFloor(85800);

    // 85.800 / 1,19 = 72.100,8403 → 72.100,85 (round normal daría 72.100,84)
    expect(floor).toBe(72100.85);
    expect(floor * 1.19).toBeGreaterThanOrEqual(85800);
  });

  it('acepta un Prisma.Decimal como precio mínimo', () => {
    expect(officialNetFloor(new Prisma.Decimal('119000'))).toBe(100000);
  });

  it('con precio mínimo 0 el piso es 0', () => {
    expect(officialNetFloor(0)).toBe(0);
  });
});

describe('sumOfficialLines', () => {
  it('suma subtotales e IVA: 997.500 + 189.525 = 1.187.025', () => {
    const line = computeOfficialLine(1, 997500);

    const { taxTotal, total } = sumOfficialLines([line]);

    expect(taxTotal.toString()).toBe('189525');
    expect(total.toString()).toBe('1187025');
  });

  it('con varias líneas el total es Σ subtotal + Σ IVA', () => {
    const lines = [
      computeOfficialLine(2, 10000), // 20.000 + 3.800
      computeOfficialLine(1, 50000), // 50.000 + 9.500
    ];

    const { taxTotal, total } = sumOfficialLines(lines);

    expect(taxTotal.toString()).toBe('13300');
    expect(total.toString()).toBe('83300');
  });

  it('suma los IVA ya redondeados de cada línea, no el IVA del total', () => {
    // Cada línea: subtotal 0,50 → IVA 0,095 → 0,10. Dos líneas: IVA 0,20 (no 0,19)
    const lines = [computeOfficialLine(1, 0.5), computeOfficialLine(1, 0.5)];

    const { taxTotal, total } = sumOfficialLines(lines);

    expect(taxTotal.toString()).toBe('0.2');
    expect(total.toString()).toBe('1.2');
  });

  it('sin líneas el IVA y el total son 0', () => {
    const { taxTotal, total } = sumOfficialLines([]);

    expect(taxTotal.toString()).toBe('0');
    expect(total.toString()).toBe('0');
  });
});
