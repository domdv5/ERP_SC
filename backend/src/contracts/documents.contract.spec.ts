import { Prisma } from '@prisma/client';
import { matchContract } from '@/common/types';
import type { DocumentListResponse } from './documents';

const matchListContract = matchContract<DocumentListResponse>();

// Lo que devuelve Prisma: total es Decimal y date/createdAt son Date.
function buildResult() {
  const user = { id: 'u1', name: 'Ana' };
  return {
    items: [
      {
        id: 'd1',
        type: 'POS' as const,
        number: '000001',
        date: new Date('2026-10-29'),
        status: 'draft' as const,
        total: new Prisma.Decimal('100.50'),
        notes: null,
        adjustmentReason: null,
        adjustmentReasonOther: null,
        refundMethod: null,
        officialPurchase: false,
        supplierInvoiceNumber: null,
        taxTotal: null,
        thirdParty: null,
        user,
        updatedBy: null,
        confirmedBy: null,
        voidedBy: null,
        warehouse: null,
        destWarehouse: null,
        editedAt: null,
        confirmedAt: null,
        voidedAt: null,
        createdAt: new Date('2026-10-29'),
        pv: null,
        officialPurchases: null,
        _count: { documentItems: 1 },
      },
    ],
    meta: {
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      draftCount: 1,
      confirmedCount: 0,
    },
  };
}

describe('matchContract (documentos)', () => {
  it('acepta un resultado que cumple el contrato y lo devuelve sin tocarlo', () => {
    const result = buildResult();
    expect(matchListContract(result)).toBe(result);
  });

  it('rechaza un campo requerido que falta', () => {
    const { items, meta } = buildResult();
    const { number: _number, ...rowWithoutNumber } = items[0];
    // @ts-expect-error falta `number`
    matchListContract({ items: [rowWithoutNumber], meta });
  });

  it('rechaza total como number (viaja como string)', () => {
    const { items, meta } = buildResult();
    // @ts-expect-error `total` debe ser Decimal/string, no number
    matchListContract({ items: [{ ...items[0], total: 100.5 }], meta });
  });

  it('rechaza un status que el contrato no conoce', () => {
    const { items, meta } = buildResult();
    // @ts-expect-error status inválido
    matchListContract({ items: [{ ...items[0], status: 'other' }], meta });
  });
});
