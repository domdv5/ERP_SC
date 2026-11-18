import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/common/types';
import { EgresosService } from './egresos.service';

const user = { sub: 'admin-1' } as JwtPayload;
const dec = (n: number) => new Prisma.Decimal(n);

const payable = (id: string, total: number, paid: number, status: string) => ({
  id,
  totalAmount: dec(total),
  paidAmount: dec(paid),
  status,
});

describe('EgresosService.void: reversión de dinero', () => {
  const tx = {
    $queryRaw: jest.fn(),
    egreso: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    accountsPayable: { findMany: jest.fn(), update: jest.fn() },
    supplierCredit: { findMany: jest.fn(), update: jest.fn() },
  };
  const prisma = { $transaction: jest.fn() };
  const service = new EgresosService(prisma as unknown as PrismaService, {
    next: jest.fn(),
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
      fn(tx),
    );
    tx.$queryRaw.mockResolvedValue([]);
    tx.supplierCredit.findMany.mockResolvedValue([]);
    tx.egreso.updateMany.mockResolvedValue({ count: 1 });
    tx.egreso.findUniqueOrThrow.mockResolvedValue({ id: 'e1' });
  });

  it('S4: A abonada 500.000 y B pagada 2.000.000 con 500.000 de saldo a favor vuelven a pendiente y el saldo queda disponible', async () => {
    tx.egreso.findUnique.mockResolvedValue({
      id: 'e1',
      allocations: [
        { accountPayableId: 'A', amount: dec(500000) },
        { accountPayableId: 'B', amount: dec(2000000) },
      ],
      creditApplications: [{ supplierCreditId: 'sc1', amount: dec(500000) }],
    });
    tx.accountsPayable.findMany.mockResolvedValue([
      payable('A', 1000000, 500000, 'partial'),
      payable('B', 2000000, 2000000, 'paid'),
    ]);
    tx.supplierCredit.findMany.mockResolvedValue([
      { id: 'sc1', balance: dec(0), status: 'used' },
    ]);

    await service.void('e1', { reason: 'otro', reasonOther: 'Error' }, user);

    expect(tx.accountsPayable.update).toHaveBeenCalledWith({
      where: { id: 'A' },
      data: { paidAmount: 0, status: 'pending' },
    });
    expect(tx.accountsPayable.update).toHaveBeenCalledWith({
      where: { id: 'B' },
      data: { paidAmount: 0, status: 'pending' },
    });
    expect(tx.supplierCredit.update).toHaveBeenCalledWith({
      where: { id: 'sc1' },
      data: { balance: 500000, status: 'available' },
    });
    expect(tx.egreso.updateMany).toHaveBeenCalledWith({
      where: { id: 'e1', voidedAt: null },
      data: {
        voidedAt: expect.any(Date),
        voidedById: 'admin-1',
        voidReason: 'otro',
        voidReasonOther: 'Error',
      },
    });
  });

  it('respeta lo que otro egreso abonó después: anular E1 deja A en parcial con 500.000', async () => {
    tx.egreso.findUnique.mockResolvedValue({
      id: 'e1',
      allocations: [{ accountPayableId: 'A', amount: dec(500000) }],
      creditApplications: [],
    });
    tx.accountsPayable.findMany.mockResolvedValue([
      payable('A', 1000000, 1000000, 'paid'),
    ]);

    await service.void('e1', { reason: 'otro', reasonOther: 'Error' }, user);

    expect(tx.accountsPayable.update).toHaveBeenCalledWith({
      where: { id: 'A' },
      data: { paidAmount: 500000, status: 'partial' },
    });
    expect(tx.supplierCredit.update).not.toHaveBeenCalled();
  });

  it('con un motivo de la lista guarda reasonOther en null aunque llegue texto', async () => {
    tx.egreso.findUnique.mockResolvedValue({
      id: 'e1',
      allocations: [],
      creditApplications: [],
    });
    tx.accountsPayable.findMany.mockResolvedValue([]);

    await service.void(
      'e1',
      { reason: 'pago_duplicado', reasonOther: 'ignorado' },
      user,
    );

    expect(tx.egreso.updateMany).toHaveBeenCalledWith({
      where: { id: 'e1', voidedAt: null },
      data: expect.objectContaining({
        voidReason: 'pago_duplicado',
        voidReasonOther: null,
      }),
    });
  });

  it('bloquea CxP y luego saldos a favor antes de reclamar el egreso', async () => {
    tx.egreso.findUnique.mockResolvedValue({
      id: 'e1',
      allocations: [{ accountPayableId: 'A', amount: dec(100) }],
      creditApplications: [{ supplierCreditId: 'sc1', amount: dec(100) }],
    });
    tx.accountsPayable.findMany.mockResolvedValue([
      payable('A', 100, 100, 'paid'),
    ]);
    tx.supplierCredit.findMany.mockResolvedValue([
      { id: 'sc1', balance: dec(0), status: 'used' },
    ]);
    const order: string[] = [];
    tx.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
      order.push(strings.join('?').includes('accounts_payable') ? 'ap' : 'sc');
      return Promise.resolve([]);
    });
    tx.egreso.updateMany.mockImplementation(() => {
      order.push('claim');
      return Promise.resolve({ count: 1 });
    });

    await service.void('e1', { reason: 'otro', reasonOther: 'Error' }, user);

    expect(order).toEqual(['ap', 'sc', 'claim']);
  });

  it('un segundo intento falla con 409 y no cambia nada', async () => {
    tx.egreso.findUnique.mockResolvedValue({
      id: 'e1',
      allocations: [{ accountPayableId: 'A', amount: dec(100) }],
      creditApplications: [],
    });
    tx.egreso.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.void('e1', { reason: 'pago_duplicado' }, user),
    ).rejects.toThrow(new ConflictException('El egreso ya está anulado'));
    expect(tx.accountsPayable.update).not.toHaveBeenCalled();
    expect(tx.supplierCredit.update).not.toHaveBeenCalled();
  });

  it('404 si el egreso no existe', async () => {
    tx.egreso.findUnique.mockResolvedValue(null);

    await expect(
      service.void('nope', { reason: 'otro', reasonOther: 'x' }, user),
    ).rejects.toThrow(NotFoundException);
    expect(tx.egreso.updateMany).not.toHaveBeenCalled();
  });
});
