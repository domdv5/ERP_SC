import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateDocumentDto } from '@/documents/dto/index';
import { DvvEffectStrategy } from './dvv-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';

const MISSING_DESTINATION =
  'Seleccione dónde se usará el saldo a favor: en facturación o en administración';

describe('DvvEffectStrategy: destino del saldo a favor', () => {
  const prisma = {};
  const strategy = new DvvEffectStrategy(prisma as unknown as PrismaService);
  const tx = {
    customerCredit: { create: jest.fn() },
  };

  const buildDocument = (overrides: object = {}) =>
    ({
      id: 'dvv1',
      warehouseId: 'w1',
      thirdPartyId: 'cus-1',
      customerBranchId: 'br-1',
      total: new Prisma.Decimal(50000),
      refundMethod: 'saldo_a_favor',
      creditUsableIn: null,
      documentItems: [],
      ...overrides,
    }) as unknown as DocumentWithItems;

  const confirm = (document: DocumentWithItems) =>
    strategy.confirm(tx as unknown as Prisma.TransactionClient, document, 'u1');

  beforeEach(() => {
    jest.resetAllMocks();
    const internals = strategy as unknown as Record<string, unknown>;
    jest
      .spyOn(
        internals as { assertValidCustomer: () => Promise<void> },
        'assertValidCustomer',
      )
      .mockResolvedValue();
    jest
      .spyOn(
        internals as { assertValidCustomerBranch: () => Promise<void> },
        'assertValidCustomerBranch',
      )
      .mockResolvedValue();
  });

  it('cambio_producto crea el saldo en facturación y sin sucursal', async () => {
    await confirm(buildDocument({ refundMethod: 'cambio_producto' }));
    expect(tx.customerCredit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usableIn: 'facturacion',
        customerBranchId: null,
        amount: 50000,
      }),
    });
  });

  it('cambio_producto ignora un destino de administración enviado', async () => {
    await confirm(
      buildDocument({
        refundMethod: 'cambio_producto',
        creditUsableIn: 'administracion',
      }),
    );
    expect(tx.customerCredit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usableIn: 'facturacion',
        customerBranchId: null,
      }),
    });
  });

  it('saldo_a_favor en administración crea el saldo con la sucursal de la DVV', async () => {
    await confirm(buildDocument({ creditUsableIn: 'administracion' }));
    expect(tx.customerCredit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usableIn: 'administracion',
        customerBranchId: 'br-1',
      }),
    });
  });

  it('saldo_a_favor en facturación crea el saldo sin sucursal', async () => {
    await confirm(buildDocument({ creditUsableIn: 'facturacion' }));
    expect(tx.customerCredit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usableIn: 'facturacion',
        customerBranchId: null,
      }),
    });
  });

  it('confirm rechaza saldo_a_favor sin destino y no crea el saldo', async () => {
    await expect(confirm(buildDocument())).rejects.toThrow(
      new BadRequestException(MISSING_DESTINATION),
    );
    expect(tx.customerCredit.create).not.toHaveBeenCalled();
  });

  it('devolucion_dinero no crea saldo', async () => {
    await confirm(buildDocument({ refundMethod: 'devolucion_dinero' }));
    expect(tx.customerCredit.create).not.toHaveBeenCalled();
  });

  it('validateCreate rechaza saldo_a_favor sin destino', async () => {
    await expect(
      strategy.validateCreate({
        thirdPartyId: 'cus-1',
        refundMethod: 'saldo_a_favor',
        items: [],
      } as unknown as CreateDocumentDto),
    ).rejects.toThrow(new BadRequestException(MISSING_DESTINATION));
  });
});
