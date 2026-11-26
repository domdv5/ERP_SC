import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/common/types';
import { SupplierPaymentsService } from './supplier-payments.service';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';

const SUPPLIER = 's1';
const user = { sub: 'u1' } as JwtPayload;

const payable = (id: string, total: number) => ({
  id,
  supplierId: SUPPLIER,
  status: 'pending',
  totalAmount: new Prisma.Decimal(total),
  paidAmount: new Prisma.Decimal(0),
});

describe('SupplierPaymentsService.create — reparto del saldo a favor', () => {
  const tx = {
    supplier: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
    accountsPayable: { findMany: jest.fn(), update: jest.fn() },
    supplierCredit: { findMany: jest.fn(), update: jest.fn() },
    supplierCreditApplication: { create: jest.fn() },
    supplierPayment: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
    supplierPaymentMethod: { createMany: jest.fn() },
    supplierPaymentAllocation: { create: jest.fn() },
  };
  const prisma = {
    supplierPayment: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const sequence = { next: jest.fn() };
  const service = new SupplierPaymentsService(
    prisma as unknown as PrismaService,
    sequence,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.supplierPayment.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
      fn(tx),
    );
    tx.supplier.findUnique.mockResolvedValue({
      id: SUPPLIER,
      thirdParty: { isSupplier: true },
    });
    tx.$queryRaw.mockResolvedValue([]);
    tx.supplierPayment.create.mockResolvedValue({ id: 'e1' });
    tx.supplierPayment.findUniqueOrThrow.mockResolvedValue({ id: 'e1' });
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
    } as CreateSupplierPaymentDto;

    await service.create(dto, user);

    const application = (accountPayableId: string, amount: number) => [
      {
        data: {
          supplierCreditId: 'sc1',
          accountPayableId,
          supplierPaymentId: 'e1',
          amount,
        },
      },
    ];
    expect(tx.supplierCreditApplication.create.mock.calls).toEqual([
      application('ap1', 100),
      application('ap2', 20),
    ]);
    expect(tx.supplierPaymentAllocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountPayableId: 'ap1',
        amount: 100,
        creditAmount: 100,
      }),
    });
    expect(tx.supplierPaymentAllocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountPayableId: 'ap2',
        amount: 50,
        creditAmount: 20,
      }),
    });
  });

  it('rechaza usar solo una parte del saldo a favor y no guarda nada', async () => {
    tx.accountsPayable.findMany.mockResolvedValue([payable('ap1', 100)]);
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
      payables: [{ accountPayableId: 'ap1', amount: 100 }],
      payments: [{ method: 'efectivo_almacen', amount: 20 }],
      credits: [{ supplierCreditId: 'sc1', amount: 80 }],
    } as CreateSupplierPaymentDto;

    await expect(service.create(dto, user)).rejects.toThrow(
      'El saldo a favor se usa completo o no se usa. Saldo disponible: 120.00',
    );
    expect(tx.supplierPayment.create).not.toHaveBeenCalled();
    expect(tx.supplierCredit.update).not.toHaveBeenCalled();
    expect(tx.supplierCreditApplication.create).not.toHaveBeenCalled();
    expect(tx.accountsPayable.update).not.toHaveBeenCalled();
  });

  it('un saldo ya usado en parte se aplica por todo lo que le queda, repartido entre dos CxP', async () => {
    tx.accountsPayable.findMany.mockResolvedValue([
      payable('ap1', 30),
      payable('ap2', 50),
    ]);
    tx.supplierCredit.findMany.mockResolvedValue([
      {
        id: 'sc1',
        supplierId: SUPPLIER,
        status: 'available',
        amount: new Prisma.Decimal(200),
        balance: new Prisma.Decimal(60),
      },
    ]);
    const dto = {
      supplierId: SUPPLIER,
      idempotencyKey: 'key',
      payables: [
        { accountPayableId: 'ap1', amount: 30 },
        { accountPayableId: 'ap2', amount: 50 },
      ],
      payments: [{ method: 'efectivo_almacen', amount: 20 }],
      credits: [{ supplierCreditId: 'sc1', amount: 60 }],
    } as CreateSupplierPaymentDto;

    await service.create(dto, user);

    expect(tx.supplierCredit.update).toHaveBeenCalledWith({
      where: { id: 'sc1' },
      data: expect.objectContaining({ balance: 0, status: 'used' }),
    });
  });
});
