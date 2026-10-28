import { BadRequestException } from '@nestjs/common';
import { DocumentType } from '@/common/enums';
import type { CreateDocumentItemDto } from '../dto/index';
import {
  assertOfficialFieldsAllowed,
  computeAmounts,
  computeItemSubtotal,
  computeTotal,
} from './document-amounts';

const item = (
  quantity: number,
  prices: { unitCost?: number; unitPrice?: number },
) => ({ productId: 'p', quantity, ...prices }) as CreateDocumentItemDto;

describe('computeItemSubtotal', () => {
  it('tipos de costo (CM, CMO, DVC): cantidad × unitCost', () => {
    const line = item(3, { unitCost: 1000, unitPrice: 9999 });

    for (const type of [DocumentType.CM, DocumentType.CMO, DocumentType.DVC]) {
      expect(computeItemSubtotal(line, type)).toBe(3000);
    }
  });

  it('tipos de precio (PV, REM, POS, COT, DVV, POSO): cantidad × unitPrice', () => {
    const line = item(3, { unitCost: 1, unitPrice: 2500 });

    for (const type of [
      DocumentType.PV,
      DocumentType.REM,
      DocumentType.POS,
      DocumentType.COT,
      DocumentType.DVV,
      DocumentType.POSO,
    ]) {
      expect(computeItemSubtotal(line, type)).toBe(7500);
    }
  });

  it('valor ausente cuenta como 0', () => {
    expect(computeItemSubtotal(item(5, {}), DocumentType.CM)).toBe(0);
    expect(computeItemSubtotal(item(5, {}), DocumentType.POS)).toBe(0);
  });
});

describe('computeTotal', () => {
  it('suma los subtotales de las líneas', () => {
    const items = [item(2, { unitCost: 1500 }), item(1, { unitCost: 400 })];

    expect(computeTotal(items, DocumentType.CM)).toBe(3400);
  });

  it('sin ítems da 0', () => {
    expect(computeTotal([], DocumentType.CM)).toBe(0);
  });
});

describe('computeAmounts', () => {
  describe('tipos normales (sin IVA aparte)', () => {
    it('CM: subtotal por línea, total y taxAmount/taxTotal en null', () => {
      const items = [item(2, { unitCost: 1500 }), item(1, { unitCost: 400 })];

      expect(computeAmounts(items, DocumentType.CM)).toEqual({
        lines: [
          { subtotal: 3000, taxAmount: null },
          { subtotal: 400, taxAmount: null },
        ],
        total: 3400,
        taxTotal: null,
      });
    });

    it('POS: usa unitPrice tal cual, sin separar IVA', () => {
      const result = computeAmounts(
        [item(2, { unitPrice: 42900 })],
        DocumentType.POS,
      );

      expect(result).toEqual({
        lines: [{ subtotal: 85800, taxAmount: null }],
        total: 85800,
        taxTotal: null,
      });
    });

    it('sin ítems: líneas vacías y total 0', () => {
      expect(computeAmounts([], DocumentType.CM)).toEqual({
        lines: [],
        total: 0,
        taxTotal: null,
      });
    });
  });

  describe('CMO (valor sin IVA, se suma el 19%)', () => {
    it('3 × 10.000: subtotal 30.000, IVA 5.700, total 35.700', () => {
      expect(
        computeAmounts([item(3, { unitCost: 10000 })], DocumentType.CMO),
      ).toEqual({
        lines: [{ subtotal: 30000, taxAmount: 5700 }],
        total: 35700,
        taxTotal: 5700,
      });
    });

    it('redondea el IVA de cada línea a centavos (half up)', () => {
      // 0,03 × 0,19 = 0,0057 → 0,01; 0,10 × 0,19 = 0,019 → 0,02
      const result = computeAmounts(
        [item(1, { unitCost: 0.03 }), item(1, { unitCost: 0.1 })],
        DocumentType.CMO,
      );

      expect(result.lines).toEqual([
        { subtotal: 0.03, taxAmount: 0.01 },
        { subtotal: 0.1, taxAmount: 0.02 },
      ]);
      expect(result.taxTotal).toBe(0.03);
      expect(result.total).toBe(0.16);
    });

    it('ignora unitPrice', () => {
      const result = computeAmounts(
        [item(1, { unitCost: 100, unitPrice: 5000 })],
        DocumentType.CMO,
      );

      expect(result.total).toBe(119);
    });

    it('sin ítems: totales en 0 (no null)', () => {
      expect(computeAmounts([], DocumentType.CMO)).toEqual({
        lines: [],
        total: 0,
        taxTotal: 0,
      });
    });
  });

  describe('POSO (precio con IVA, se separa)', () => {
    it('42.900 con IVA: subtotal 36.050,42, IVA 6.849,58, total exacto 42.900', () => {
      expect(
        computeAmounts([item(1, { unitPrice: 42900 })], DocumentType.POSO),
      ).toEqual({
        lines: [{ subtotal: 36050.42, taxAmount: 6849.58 }],
        total: 42900,
        taxTotal: 6849.58,
      });
    });

    it('cantidad > 1: separa sobre el total de la línea', () => {
      const result = computeAmounts(
        [item(3, { unitPrice: 42900 })],
        DocumentType.POSO,
      );

      expect(result.total).toBe(128700);
      expect(result.lines[0].subtotal + (result.lines[0].taxAmount ?? 0)).toBe(
        128700,
      );
    });

    it('ignora unitCost', () => {
      const result = computeAmounts(
        [item(1, { unitCost: 1, unitPrice: 119 })],
        DocumentType.POSO,
      );

      expect(result).toEqual({
        lines: [{ subtotal: 100, taxAmount: 19 }],
        total: 119,
        taxTotal: 19,
      });
    });

    it('sin ítems: totales en 0', () => {
      expect(computeAmounts([], DocumentType.POSO)).toEqual({
        lines: [],
        total: 0,
        taxTotal: 0,
      });
    });
  });
});

describe('assertOfficialFieldsAllowed', () => {
  const messageOf = (fn: () => void) => {
    try {
      fn();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      return (error as BadRequestException).message;
    }
    return null;
  };

  it('sin campos oficiales no rechaza ningún tipo', () => {
    for (const type of Object.values(DocumentType)) {
      expect(() => assertOfficialFieldsAllowed(type, {})).not.toThrow();
    }
  });

  it('officialPurchase solo en CM', () => {
    expect(() =>
      assertOfficialFieldsAllowed(DocumentType.CM, { officialPurchase: true }),
    ).not.toThrow();
    expect(
      messageOf(() =>
        assertOfficialFieldsAllowed(DocumentType.CMO, {
          officialPurchase: true,
        }),
      ),
    ).toBe('Solo una compra (CM) puede marcarse como oficial');
  });

  it('supplierInvoiceNumber solo en CM y CMO; en blanco se ignora', () => {
    for (const type of [DocumentType.CM, DocumentType.CMO]) {
      expect(() =>
        assertOfficialFieldsAllowed(type, { supplierInvoiceNumber: 'F-1' }),
      ).not.toThrow();
    }
    expect(
      messageOf(() =>
        assertOfficialFieldsAllowed(DocumentType.POS, {
          supplierInvoiceNumber: 'F-1',
        }),
      ),
    ).toBe('El número de factura del proveedor solo aplica a compras');
    expect(() =>
      assertOfficialFieldsAllowed(DocumentType.POS, {
        supplierInvoiceNumber: '   ',
      }),
    ).not.toThrow();
  });

  it('sourceDocumentId solo en CMO', () => {
    expect(() =>
      assertOfficialFieldsAllowed(DocumentType.CMO, { sourceDocumentId: 'd' }),
    ).not.toThrow();
    expect(
      messageOf(() =>
        assertOfficialFieldsAllowed(DocumentType.CM, { sourceDocumentId: 'd' }),
      ),
    ).toBe('Solo una compra oficial (CMO) puede enlazar una compra de origen');
  });
});
