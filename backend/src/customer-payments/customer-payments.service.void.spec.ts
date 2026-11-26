import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/common/types';
import { CustomerPaymentsService } from './customer-payments.service';

const user = { sub: 'admin-1' } as JwtPayload;
const dec = (n: number) => new Prisma.Decimal(n);

const receivable = (
  id: string,
  total: number,
  paid: number,
  status: string,
) => ({
  id,
  totalAmount: dec(total),
  paidAmount: dec(paid),
  status,
});

describe('CustomerPaymentsService.void: reversión de dinero', () => {
  const tx = {
    $queryRaw: jest.fn(),
    customerPayment: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    accountsReceivable: { findMany: jest.fn(), update: jest.fn() },
    customerCredit: { findMany: jest.fn(), update: jest.fn() },
  };
  const prisma = { $transaction: jest.fn() };
  const service = new CustomerPaymentsService(
    prisma as unknown as PrismaService,
    {
      next: jest.fn(),
    } as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
      fn(tx),
    );
    tx.$queryRaw.mockResolvedValue([]);
    tx.customerCredit.findMany.mockResolvedValue([]);
    tx.customerPayment.updateMany.mockResolvedValue({ count: 1 });
    tx.customerPayment.findUniqueOrThrow.mockResolvedValue({ id: 'r1' });
  });

  it('S10: COT-10 (100.000) y COT-11 (50.000) pagadas con 120.000 + 20.000 de saldo + 10.000 de descuento vuelven a pendiente y el saldo queda disponible', async () => {
    tx.customerPayment.findUnique.mockResolvedValue({
      id: 'r1',
      allocations: [
        { accountReceivableId: 'COT10', amount: dec(100000) },
        { accountReceivableId: 'COT11', amount: dec(50000) },
      ],
      creditApplications: [{ customerCreditId: 'cc1', amount: dec(20000) }],
    });
    tx.accountsReceivable.findMany.mockResolvedValue([
      receivable('COT10', 100000, 100000, 'paid'),
      receivable('COT11', 50000, 50000, 'paid'),
    ]);
    tx.customerCredit.findMany.mockResolvedValue([
      { id: 'cc1', balance: dec(0), status: 'used' },
    ]);

    await service.void('r1', { reason: 'otro', reasonOther: 'Error' }, user);

    expect(tx.accountsReceivable.update).toHaveBeenCalledWith({
      where: { id: 'COT10' },
      data: { paidAmount: 0, status: 'pending' },
    });
    expect(tx.accountsReceivable.update).toHaveBeenCalledWith({
      where: { id: 'COT11' },
      data: { paidAmount: 0, status: 'pending' },
    });
    expect(tx.customerCredit.update).toHaveBeenCalledWith({
      where: { id: 'cc1' },
      data: { balance: 20000, status: 'available' },
    });
    expect(tx.customerPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', voidedAt: null },
      data: {
        voidedAt: expect.any(Date),
        voidedById: 'admin-1',
        voidReason: 'otro',
        voidReasonOther: 'Error',
      },
    });
  });

  it('un mismo saldo a favor repartido entre dos CxC devuelve la suma de sus tramos', async () => {
    tx.customerPayment.findUnique.mockResolvedValue({
      id: 'r1',
      allocations: [
        { accountReceivableId: 'COT10', amount: dec(100000) },
        { accountReceivableId: 'COT11', amount: dec(50000) },
      ],
      creditApplications: [
        { customerCreditId: 'cc1', amount: dec(15000) },
        { customerCreditId: 'cc1', amount: dec(5000) },
      ],
    });
    tx.accountsReceivable.findMany.mockResolvedValue([
      receivable('COT10', 100000, 100000, 'paid'),
      receivable('COT11', 50000, 50000, 'paid'),
    ]);
    tx.customerCredit.findMany.mockResolvedValue([
      { id: 'cc1', balance: dec(0), status: 'used' },
    ]);

    await service.void('r1', { reason: 'pago_duplicado' }, user);

    expect(tx.customerCredit.update).toHaveBeenCalledTimes(1);
    expect(tx.customerCredit.update).toHaveBeenCalledWith({
      where: { id: 'cc1' },
      data: { balance: 20000, status: 'available' },
    });
  });

  it('respeta lo que otro recibo abonó después: anular R1 deja la CxC en parcial con lo de R2', async () => {
    tx.customerPayment.findUnique.mockResolvedValue({
      id: 'r1',
      allocations: [{ accountReceivableId: 'A', amount: dec(40000) }],
      creditApplications: [],
    });
    tx.accountsReceivable.findMany.mockResolvedValue([
      receivable('A', 100000, 100000, 'paid'),
    ]);

    await service.void('r1', { reason: 'otro', reasonOther: 'Error' }, user);

    expect(tx.accountsReceivable.update).toHaveBeenCalledWith({
      where: { id: 'A' },
      data: { paidAmount: 60000, status: 'partial' },
    });
    expect(tx.customerCredit.update).not.toHaveBeenCalled();
  });

  it('si el recibo abonó más de lo que la CxC tiene pagado aborta con 409', async () => {
    tx.customerPayment.findUnique.mockResolvedValue({
      id: 'r1',
      allocations: [{ accountReceivableId: 'A', amount: dec(40000) }],
      creditApplications: [],
    });
    tx.accountsReceivable.findMany.mockResolvedValue([
      receivable('A', 100000, 10000, 'partial'),
    ]);

    await expect(
      service.void('r1', { reason: 'otro', reasonOther: 'Error' }, user),
    ).rejects.toThrow(ConflictException);
    expect(tx.accountsReceivable.update).not.toHaveBeenCalled();
  });

  it('con un motivo de la lista guarda reasonOther en null aunque llegue texto', async () => {
    tx.customerPayment.findUnique.mockResolvedValue({
      id: 'r1',
      allocations: [],
      creditApplications: [],
    });
    tx.accountsReceivable.findMany.mockResolvedValue([]);

    await service.void(
      'r1',
      { reason: 'pago_duplicado', reasonOther: 'ignorado' },
      user,
    );

    expect(tx.customerPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', voidedAt: null },
      data: expect.objectContaining({
        voidReason: 'pago_duplicado',
        voidReasonOther: null,
      }),
    });
  });

  it('bloquea saldos a favor y luego CxC antes de reclamar el recibo', async () => {
    tx.customerPayment.findUnique.mockResolvedValue({
      id: 'r1',
      allocations: [{ accountReceivableId: 'A', amount: dec(100) }],
      creditApplications: [{ customerCreditId: 'cc1', amount: dec(100) }],
    });
    tx.accountsReceivable.findMany.mockResolvedValue([
      receivable('A', 100, 100, 'paid'),
    ]);
    tx.customerCredit.findMany.mockResolvedValue([
      { id: 'cc1', balance: dec(0), status: 'used' },
    ]);
    const order: string[] = [];
    tx.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
      order.push(
        strings.join('?').includes('customer_credit') ? 'credit' : 'ar',
      );
      return Promise.resolve([]);
    });
    tx.customerPayment.updateMany.mockImplementation(() => {
      order.push('claim');
      return Promise.resolve({ count: 1 });
    });

    await service.void('r1', { reason: 'otro', reasonOther: 'Error' }, user);

    expect(order).toEqual(['credit', 'ar', 'claim']);
  });

  it('un segundo intento falla con 409 y no cambia nada', async () => {
    tx.customerPayment.findUnique.mockResolvedValue({
      id: 'r1',
      allocations: [{ accountReceivableId: 'A', amount: dec(100) }],
      creditApplications: [],
    });
    tx.customerPayment.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.void('r1', { reason: 'pago_duplicado' }, user),
    ).rejects.toThrow(
      new ConflictException('El recibo de caja ya está anulado'),
    );
    expect(tx.accountsReceivable.update).not.toHaveBeenCalled();
    expect(tx.customerCredit.update).not.toHaveBeenCalled();
  });

  it('404 si el recibo no existe', async () => {
    tx.customerPayment.findUnique.mockResolvedValue(null);

    await expect(
      service.void('nope', { reason: 'otro', reasonOther: 'x' }, user),
    ).rejects.toThrow(NotFoundException);
    expect(tx.customerPayment.updateMany).not.toHaveBeenCalled();
  });
});
