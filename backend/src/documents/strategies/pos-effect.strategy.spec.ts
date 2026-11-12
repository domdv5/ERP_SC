import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { applyCustomerCredits } from '@/documents/helpers/customer-credit.helpers';
import { assertCreditWithinLimit } from '@/documents/helpers/credit.helpers';
import { CreateDocumentDto } from '@/documents/dto/index';
import { PosEffectStrategy } from './pos-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';

jest.mock('@/documents/helpers/customer-credit.helpers');
jest.mock('@/documents/helpers/credit.helpers');

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
    const document = makeDocument([
      { method: 'efectivo_almacen', amount: 90000 },
    ]);

    await expect(strategy.confirm(tx, document, 'u1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('descuenta los saldos a favor del total a cobrar', async () => {
    const full = makeDocument([{ method: 'efectivo_almacen', amount: 100000 }]);
    await expect(
      strategy.confirm(tx, full, 'u1', { appliedCustomerCredits: credits }),
    ).rejects.toThrow(BadRequestException);

    const net = makeDocument([
      { method: 'efectivo_almacen', amount: 40000 },
      { method: 'consignacion_almacen', amount: 30000 },
    ]);
    await expect(
      strategy.confirm(tx, net, 'u1', { appliedCustomerCredits: credits }),
    ).resolves.toBeUndefined();
    expect(applyCustomerCredits).toHaveBeenCalledTimes(1);
  });

  it('acepta pagos que suman el total sin saldos a favor', async () => {
    const document = makeDocument([
      { method: 'efectivo_almacen', amount: 60000 },
      { method: 'consignacion_almacen', amount: 40000 },
    ]);

    await expect(strategy.confirm(tx, document, 'u1')).resolves.toBeUndefined();
  });

  it('no mueve stock si los pagos no cuadran', async () => {
    const moveStock = jest
      .spyOn(internals as { moveStock: () => Promise<void> }, 'moveStock')
      .mockResolvedValue();
    const document = {
      ...makeDocument([{ method: 'efectivo_almacen', amount: 1 }]),
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

describe('PosEffectStrategy: parte a crédito', () => {
  const prisma = {} as PrismaService;
  const strategy = new PosEffectStrategy(prisma);
  const internals = strategy as unknown as Record<string, unknown>;
  const tx = {
    $queryRaw: jest.fn(),
    accountsReceivable: { create: jest.fn() },
  };
  const txClient = tx as unknown as Prisma.TransactionClient;
  const CREDIT_ONLY_MESSAGE =
    'El crédito no puede cubrir toda la venta. Si todo queda a crédito, haz una venta a crédito (COT).';

  const makeSale = (
    payments: { method: string; amount: number }[],
    total = 500000,
  ) =>
    ({
      id: 'doc-1',
      thirdPartyId: 'cus-1',
      sellerId: 'sel-1',
      customerBranchId: null,
      warehouseId: 'store-1',
      total: new Prisma.Decimal(total),
      payments,
      documentItems: [],
    }) as unknown as DocumentWithItems;

  const cashAndCredit = [
    { method: 'efectivo_almacen', amount: 300000 },
    { method: 'credito', amount: 200000 },
  ];
  let moveStock: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
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
    jest
      .spyOn(
        internals as { validateCashSale: () => Promise<void> },
        'validateCashSale',
      )
      .mockResolvedValue();
    moveStock = jest
      .spyOn(internals as { moveStock: () => Promise<void> }, 'moveStock')
      .mockResolvedValue();
  });

  it('confirm: crea una sola CxC por el monto de la línea crédito y bloquea al cliente', async () => {
    await strategy.confirm(txClient, makeSale(cashAndCredit), 'u1');

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect((tx.$queryRaw.mock.calls[0][0] as string[]).join('?')).toContain(
      'FOR UPDATE',
    );
    expect(assertCreditWithinLimit).toHaveBeenCalledWith(
      txClient,
      'cus-1',
      200000,
    );
    expect(tx.accountsReceivable.create).toHaveBeenCalledTimes(1);
    const { data } = tx.accountsReceivable.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(data).toMatchObject({
      clientId: 'cus-1',
      sellerId: 'sel-1',
      documentId: 'doc-1',
      status: 'pending',
    });
    expect(Number(data.totalAmount)).toBe(200000);
  });

  it('confirm sin crédito: no crea CxC ni bloquea al cliente', async () => {
    await strategy.confirm(
      txClient,
      makeSale([{ method: 'efectivo_almacen', amount: 500000 }]),
      'u1',
    );

    expect(tx.accountsReceivable.create).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(assertCreditWithinLimit).not.toHaveBeenCalled();
  });

  it('crédito igual al total a cobrar: 400, sin stock ni CxC', async () => {
    const document = {
      ...makeSale([{ method: 'credito', amount: 500000 }]),
      documentItems: [
        {
          id: 'i1',
          productId: 'p1',
          quantity: 1,
          unitPrice: 500000,
          product: { code: 'P', avgCost: 1, minSalePrice: 0 },
        },
      ],
    } as unknown as DocumentWithItems;

    await expect(strategy.confirm(txClient, document, 'u1')).rejects.toThrow(
      new BadRequestException(CREDIT_ONLY_MESSAGE),
    );
    expect(moveStock).not.toHaveBeenCalled();
    expect(tx.accountsReceivable.create).not.toHaveBeenCalled();
  });

  it('con saldos a favor, el 100% se mide contra el total menos los saldos', async () => {
    const credits = [{ customerCreditId: 'cc-1', amount: 100000 }];

    await expect(
      strategy.confirm(
        txClient,
        makeSale([{ method: 'credito', amount: 400000 }]),
        'u1',
        { appliedCustomerCredits: credits },
      ),
    ).rejects.toThrow(new BadRequestException(CREDIT_ONLY_MESSAGE));

    await expect(
      strategy.confirm(txClient, makeSale(cashAndCredit), 'u1', {
        appliedCustomerCredits: [{ customerCreditId: 'cc-1', amount: 100000 }],
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      strategy.confirm(
        txClient,
        makeSale([
          { method: 'efectivo_almacen', amount: 200000 },
          { method: 'credito', amount: 200000 },
        ]),
        'u1',
        { appliedCustomerCredits: credits },
      ),
    ).resolves.toBeUndefined();
    expect(tx.accountsReceivable.create).toHaveBeenCalledTimes(1);
  });

  it('cupo excedido en confirm: propaga el 400 y no crea CxC', async () => {
    jest
      .mocked(assertCreditWithinLimit)
      .mockRejectedValue(new BadRequestException('Supera el cupo'));

    await expect(
      strategy.confirm(txClient, makeSale(cashAndCredit), 'u1'),
    ).rejects.toThrow(new BadRequestException('Supera el cupo'));
    expect(tx.accountsReceivable.create).not.toHaveBeenCalled();
    expect(moveStock).not.toHaveBeenCalled();
  });

  it('validateCreate con línea crédito valida el cupo sobre ese monto', async () => {
    await strategy.validateCreate({
      thirdPartyId: 'cus-1',
      payments: cashAndCredit,
    } as unknown as CreateDocumentDto);

    expect(assertCreditWithinLimit).toHaveBeenCalledWith(
      prisma,
      'cus-1',
      200000,
    );
  });

  it('validateCreate sin línea crédito no valida el cupo', async () => {
    await strategy.validateCreate({
      thirdPartyId: 'cus-1',
      payments: [{ method: 'efectivo_almacen', amount: 500000 }],
    } as unknown as CreateDocumentDto);

    expect(assertCreditWithinLimit).not.toHaveBeenCalled();
  });
});
