import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AccountsReceivableService } from './accounts-receivable.service';

const decimal = (value: string) => new Prisma.Decimal(value);

const saleDate = new Date('2026-09-01T00:00:00.000Z');

describe('AccountsReceivableService.getClientStatement', () => {
  const prisma = {
    customer: { findUnique: jest.fn() },
    accountsReceivable: { findMany: jest.fn() },
    customerCredit: { findMany: jest.fn() },
    customerBranch: { findMany: jest.fn() },
    $transaction: jest.fn((queries: unknown[]) => Promise.all(queries)),
  };
  const service = new AccountsReceivableService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.customerBranch.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation((queries: unknown[]) =>
      Promise.all(queries),
    );
  });

  it('lanza 404 si el cliente no existe', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(service.getClientStatement('x')).rejects.toThrow(
      new NotFoundException('Cliente no encontrado'),
    );
    expect(prisma.accountsReceivable.findMany).not.toHaveBeenCalled();
  });

  it('calcula totales y suma solo los créditos disponibles', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      thirdParty: { id: 'c1', name: 'Cliente Uno' },
    });
    prisma.accountsReceivable.findMany.mockResolvedValue([
      {
        id: 'a',
        totalAmount: decimal('100.10'),
        paidAmount: decimal('40'),
        status: 'partial',
        document: { customerBranchId: null, date: saleDate },
        receivablePayments: [],
        reciboCajaAllocations: [],
      },
      {
        id: 'b',
        totalAmount: decimal('50'),
        paidAmount: decimal('50'),
        status: 'paid',
        document: { customerBranchId: null, date: saleDate },
        receivablePayments: [],
        reciboCajaAllocations: [],
      },
    ]);
    prisma.customerCredit.findMany.mockResolvedValue([
      { id: 'k1', status: 'available', balance: decimal('30.5') },
      { id: 'k2', status: 'used', balance: decimal('0') },
      { id: 'k3', status: 'available', balance: decimal('9.5') },
    ]);

    const result = await service.getClientStatement('c1');

    expect(result.client).toEqual({ id: 'c1', name: 'Cliente Uno' });
    expect(result.totals.totalDebt.toString()).toBe('150.1');
    expect(result.totals.totalPaid.toString()).toBe('90');
    expect(result.totals.totalBalance.toString()).toBe('60.1');
    expect(result.totals.availableCredit.toString()).toBe('40');
    expect(result.receivables.map((r) => r.balance.toString())).toEqual([
      '60.1',
      '0',
    ]);
    expect(result.credits).toHaveLength(3);
  });

  it('cada CxC trae la fecha del último pago (pago histórico o recibo de caja) y los días, sin los pagos crudos', async () => {
    prisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      thirdParty: { id: 'c1', name: 'Cliente Uno' },
    });
    prisma.accountsReceivable.findMany.mockResolvedValue([
      {
        id: 'paid',
        totalAmount: decimal('50'),
        paidAmount: decimal('50'),
        status: 'paid',
        document: { customerBranchId: null, date: saleDate },
        receivablePayments: [
          { paymentDate: new Date('2026-09-05T00:00:00.000Z') },
        ],
        reciboCajaAllocations: [
          { reciboCaja: { date: new Date('2026-09-15T00:00:00.000Z') } },
        ],
      },
      {
        id: 'pending',
        totalAmount: decimal('20'),
        paidAmount: decimal('0'),
        status: 'pending',
        document: { customerBranchId: null, date: saleDate },
        receivablePayments: [],
        reciboCajaAllocations: [],
      },
    ]);
    prisma.customerCredit.findMany.mockResolvedValue([]);

    const result = await service.getClientStatement('c1');
    const [paid, pending] = result.receivables;

    expect(paid.lastPaymentDate).toEqual(new Date('2026-09-15T00:00:00.000Z'));
    expect(paid.paymentDays).toBe(14);
    expect(paid.isPaymentOpen).toBe(false);
    expect(pending.lastPaymentDate).toBeNull();
    expect(pending.isPaymentOpen).toBe(true);
    expect(paid).not.toHaveProperty('receivablePayments');
    expect(paid).not.toHaveProperty('reciboCajaAllocations');
  });
});

describe('AccountsReceivableService: sucursales del cliente', () => {
  const prisma = {
    customer: { findUnique: jest.fn() },
    accountsReceivable: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    customerCredit: { findMany: jest.fn() },
    customerBranch: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new AccountsReceivableService(
    prisma as unknown as PrismaService,
  );

  const receivable = (
    id: string,
    total: string,
    paid: string,
    branch: { id: string; name: string } | null,
  ) => ({
    id,
    totalAmount: decimal(total),
    paidAmount: decimal(paid),
    status: 'pending',
    document: {
      customerBranchId: branch?.id ?? null,
      customerBranch: branch,
      date: saleDate,
    },
    receivablePayments: [],
    reciboCajaAllocations: [],
  });
  const centro = { id: 'b1', name: 'Centro' };
  const norte = { id: 'b2', name: 'Norte' };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      thirdParty: { id: 'c1', name: 'Cliente Uno' },
    });
    prisma.customerCredit.findMany.mockResolvedValue([]);
    prisma.customerBranch.findMany.mockResolvedValue([centro, norte]);
    prisma.accountsReceivable.findMany.mockResolvedValue([
      receivable('a', '100', '40', centro),
      receivable('b', '50', '0', centro),
      receivable('c', '30', '30', null),
    ]);
  });

  describe('getClientStatement', () => {
    it('devuelve branchTotals por sucursal, con ceros y una fila "Sin sucursal"', async () => {
      const { branchTotals } = await service.getClientStatement('c1');

      expect(
        branchTotals.map((row) => [
          row.branchId,
          row.name,
          row.totalDebt.toString(),
          row.totalPaid.toString(),
          row.totalBalance.toString(),
        ]),
      ).toEqual([
        ['b1', 'Centro', '150', '40', '110'],
        ['b2', 'Norte', '0', '0', '0'],
        [null, 'Sin sucursal', '30', '30', '0'],
      ]);
    });

    it('omite "Sin sucursal" si todas las CxC tienen sucursal', async () => {
      prisma.accountsReceivable.findMany.mockResolvedValue([
        receivable('a', '100', '40', centro),
      ]);

      const { branchTotals } = await service.getClientStatement('c1');

      expect(branchTotals.map((row) => row.branchId)).toEqual(['b1', 'b2']);
    });

    it('con customerBranchId filtra receivables y totals, pero branchTotals sigue completo', async () => {
      const result = await service.getClientStatement('c1', 'b1');

      expect(result.receivables.map((r) => r.id)).toEqual(['a', 'b']);
      expect(result.totals.totalDebt.toString()).toBe('150');
      expect(result.branchTotals).toHaveLength(3);
      expect(result.branchTotals[2].totalDebt.toString()).toBe('30');
    });
  });

  describe('findAll', () => {
    it('filtra por la sucursal del documento', async () => {
      prisma.$transaction.mockResolvedValue([
        [],
        0,
        { _sum: { totalAmount: null, paidAmount: null } },
      ]);

      await service.findAll({ customerBranchId: 'b1' });

      expect(prisma.accountsReceivable.findMany.mock.calls[0][0].where).toEqual(
        { document: { customerBranchId: 'b1' } },
      );
    });

    it('ordena por último movimiento (venta o abono), el más reciente primero', async () => {
      prisma.$transaction.mockResolvedValue([
        [],
        0,
        { _sum: { totalAmount: null, paidAmount: null } },
      ]);

      await service.findAll({});

      expect(
        prisma.accountsReceivable.findMany.mock.calls[0][0].orderBy,
      ).toEqual([{ updatedAt: 'desc' }, { id: 'desc' }]);
    });
  });

  it('el estado de cuenta ordena por último movimiento, el más reciente primero', async () => {
    prisma.accountsReceivable.findMany.mockResolvedValue([]);

    await service.getClientStatement('c1');

    expect(prisma.accountsReceivable.findMany.mock.calls[0][0].orderBy).toEqual(
      [{ updatedAt: 'desc' }, { id: 'desc' }],
    );
  });
});
