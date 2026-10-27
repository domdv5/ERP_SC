import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { applyCustomerCredits } from '@/documents/helpers/customer-credit.helpers';
import { PosEffectStrategy } from './pos-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';

jest.mock('@/documents/helpers/customer-credit.helpers');

const makeDocument = (payments: { method: string; amount: number }[]) =>
  ({
    id: 'doc-1',
    thirdPartyId: 'cus-1',
    customerBranchId: null,
    warehouseId: 'store-1',
    total: new Prisma.Decimal(100000),
    payments,
    documentItems: [],
  }) as unknown as DocumentWithItems;

describe('PosEffectStrategy: formas de pago al confirmar', () => {
  const strategy = new PosEffectStrategy({} as PrismaService);
  const tx = {} as Prisma.TransactionClient;
  const credits = [{ customerCreditId: 'cc-1', amount: 30000 }];
  const internals = strategy as unknown as Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(
        internals as { assertValidCustomerBranch: () => Promise<void> },
        'assertValidCustomerBranch',
      )
      .mockResolvedValue();
    jest
      .spyOn(
        internals as { findMissingStock: () => Promise<unknown[]> },
        'findMissingStock',
      )
      .mockResolvedValue([]);
  });

  it('rechaza si no hay formas de pago', async () => {
    await expect(strategy.confirm(tx, makeDocument([]), 'u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza si las formas de pago no suman el total', async () => {
    const document = makeDocument([{ method: 'efectivo', amount: 90000 }]);

    await expect(strategy.confirm(tx, document, 'u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('descuenta los saldos a favor del total a cobrar', async () => {
    const full = makeDocument([{ method: 'efectivo', amount: 100000 }]);
    await expect(
      strategy.confirm(tx, full, 'u1', { appliedCustomerCredits: credits }),
    ).rejects.toThrow(BadRequestException);

    const net = makeDocument([
      { method: 'efectivo', amount: 40000 },
      { method: 'transferencia', amount: 30000 },
    ]);
    await expect(
      strategy.confirm(tx, net, 'u1', { appliedCustomerCredits: credits }),
    ).resolves.toBeUndefined();
    expect(applyCustomerCredits).toHaveBeenCalledTimes(1);
  });

  it('acepta pagos que suman el total sin saldos a favor', async () => {
    const document = makeDocument([
      { method: 'efectivo', amount: 60000 },
      { method: 'tarjeta', amount: 40000 },
    ]);

    await expect(strategy.confirm(tx, document, 'u1')).resolves.toBeUndefined();
  });

  it('no mueve stock si los pagos no cuadran', async () => {
    const moveStock = jest
      .spyOn(internals as { moveStock: () => Promise<void> }, 'moveStock')
      .mockResolvedValue();
    const document = {
      ...makeDocument([{ method: 'efectivo', amount: 1 }]),
      documentItems: [
        {
          id: 'i1',
          productId: 'p1',
          quantity: 1,
          unitPrice: 100000,
          product: { code: 'P', avgCost: 1, minSalePrice: 0 },
        },
      ],
    } as unknown as DocumentWithItems;

    await expect(strategy.confirm(tx, document, 'u1')).rejects.toThrow(
      BadRequestException,
    );
    expect(moveStock).not.toHaveBeenCalled();
  });
});
