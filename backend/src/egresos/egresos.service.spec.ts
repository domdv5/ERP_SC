import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/common/types';
import { EgresosService } from './egresos.service';
import { CreateEgresoDto } from './dto/create-egreso.dto';

const SUPPLIER = 's1';
const user = { sub: 'u1' } as JwtPayload;

const payable = (id: string, total: number) => ({
  id,
  supplierId: SUPPLIER,
  status: 'pending',
  totalAmount: new Prisma.Decimal(total),
  paidAmount: new Prisma.Decimal(0),
});

describe('EgresosService.create — reparto del saldo a favor', () => {
  const tx = {
    supplier: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
    accountsPayable: { findMany: jest.fn(), update: jest.fn() },
    supplierCredit: { findMany: jest.fn(), update: jest.fn() },
    supplierCreditApplication: { create: jest.fn() },
    egreso: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
    egresoPayment: { createMany: jest.fn() },
    egresoAllocation: { create: jest.fn() },
  };
  const prisma = {
    egreso: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const sequence = { next: jest.fn() };
  const service = new EgresosService(
    prisma as unknown as PrismaService,
    sequence,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.egreso.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
      fn(tx),
    );
    tx.supplier.findUnique.mockResolvedValue({
      id: SUPPLIER,
      thirdParty: { isSupplier: true },
    });
    tx.$queryRaw.mockResolvedValue([]);
    tx.egreso.create.mockResolvedValue({ id: 'e1' });
    tx.egreso.findUniqueOrThrow.mockResolvedValue({ id: 'e1' });
    sequence.next.mockResolvedValue('000001');
  });

  it('la CxP más antigua consume el saldo primero y el resto pasa a la siguiente', async () => {
    tx.accountsPayable.findMany.mockResolvedValue([
      payable('ap1', 100),
      payable('ap2', 50),
    ]);
    tx.supplierCredit.findMany.mockResolvedValue([
      {
        id: 'sc1',
        supplierId: SUPPLIER,
        status: 'available',
        balance: new Prisma.Decimal(120),
      },
    ]);
    const dto = {
      supplierId: SUPPLIER,
      idempotencyKey: 'key',
      payables: [
        { accountPayableId: 'ap1', amount: 100 },
        { accountPayableId: 'ap2', amount: 50 },
      ],
      payments: [{ method: 'efectivo_almacen', amount: 30 }],
      credits: [{ supplierCreditId: 'sc1', amount: 120 }],
    } as CreateEgresoDto;

    await service.create(dto, user);

    const application = (accountPayableId: string, amount: number) => [
      {
        data: {
          supplierCreditId: 'sc1',
          accountPayableId,
          egresoId: 'e1',
          amount,
        },
      },
    ];
    expect(tx.supplierCreditApplication.create.mock.calls).toEqual([
      application('ap1', 100),
      application('ap2', 20),
    ]);
    expect(tx.egresoAllocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountPayableId: 'ap1',
        amount: 100,
        creditAmount: 100,
      }),
    });
    expect(tx.egresoAllocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountPayableId: 'ap2',
        amount: 50,
        creditAmount: 20,
      }),
    });
  });
});
