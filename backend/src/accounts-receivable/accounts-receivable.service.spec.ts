import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AccountsReceivableService } from './accounts-receivable.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { todayInBogota } from '@/common/utils/date-range.util';
import { FindReceivableClientsDto } from './dto/index';

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
      {
        id: 'k1',
        kind: 'devolucion',
        status: 'available',
        balance: decimal('30.5'),
      },
      { id: 'k2', kind: 'devolucion', status: 'used', balance: decimal('0') },
      {
        id: 'k3',
        kind: 'devolucion',
        status: 'available',
        balance: decimal('9.5'),
      },
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

    describe('excedentes', () => {
      const credit = (
        id: string,
        kind: 'devolucion' | 'excedente',
        status: string,
        balance: string,
        customerBranchId: string | null,
      ) => ({ id, kind, status, balance: decimal(balance), customerBranchId });

      beforeEach(() =>
        prisma.customerCredit.findMany.mockResolvedValue([
          credit('dvv', 'devolucion', 'available', '20', null),
          credit('e1', 'excedente', 'available', '100', 'b1'),
          credit('e2', 'excedente', 'voided', '0', 'b1'),
          credit('e3', 'excedente', 'available', '5', null),
          credit('e4', 'excedente', 'used', '0', 'b2'),
        ]),
      );

      it('availableCredit suma solo devoluciones y availableExcedente solo excedentes disponibles', async () => {
        const { totals } = await service.getClientStatement('c1');
        expect(totals.availableCredit.toString()).toBe('20');
        expect(totals.availableExcedente.toString()).toBe('105');
      });

      it('branchTotals trae el excedente disponible de cada sucursal', async () => {
        const { branchTotals } = await service.getClientStatement('c1');
        expect(
          branchTotals.map((row) => [
            row.branchId,
            row.availableExcedente.toString(),
          ]),
        ).toEqual([
          ['b1', '100'],
          ['b2', '0'],
          [null, '5'],
        ]);
      });

      it('con customerBranchId solo deja los excedentes de esa sucursal', async () => {
        const result = await service.getClientStatement('c1', 'b1');
        expect(result.totals.availableExcedente.toString()).toBe('100');
        expect(result.credits.map((c) => c.id)).toEqual(['dvv', 'e1', 'e2']);
      });
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

describe('AccountsReceivableService.findClients', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn((queries: unknown[]) => Promise.all(queries)),
  };
  const service = new AccountsReceivableService(
    prisma as unknown as PrismaService,
  );
  const sqlOf = (call: unknown[]) =>
    Prisma.sql(call[0] as TemplateStringsArray, ...call.slice(1)).sql;

  const groupRow = {
    client_id: 'c1',
    client_name: 'Cliente Uno',
    receivable_count: 4,
    total_amount: decimal('1000.10'),
    paid_amount: decimal('400.05'),
    last_sale_date: saleDate,
    last_payment_date: new Date('2026-09-20T00:00:00.000Z'),
    last_movement_at: new Date('2026-09-21T15:00:00.000Z'),
    oldest_pending_date: new Date('2026-09-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((queries: unknown[]) =>
      Promise.all(queries),
    );
    prisma.$queryRaw.mockResolvedValueOnce([groupRow]).mockResolvedValueOnce([
      {
        client_count: 41,
        total_amount: decimal('9000.50'),
        paid_amount: decimal('2000.25'),
      },
    ]);
  });

  it('una fila por cliente con saldo derivado y las fechas del grupo', async () => {
    const result = await service.findClients({ page: 1, limit: 20 });

    expect(result.items).toEqual([
      {
        client: { id: 'c1', name: 'Cliente Uno' },
        receivableCount: 4,
        totalAmount: decimal('1000.10'),
        paidAmount: decimal('400.05'),
        balance: decimal('600.05'),
        lastSaleDate: saleDate,
        lastPaymentDate: new Date('2026-09-20T00:00:00.000Z'),
        lastMovementAt: new Date('2026-09-21T15:00:00.000Z'),
        oldestPendingDays: expect.any(Number),
      },
    ]);
  });

  it('lastPaymentDate es null si el cliente no tiene pagos', async () => {
    prisma.$queryRaw.mockReset();
    prisma.$queryRaw
      .mockResolvedValueOnce([{ ...groupRow, last_payment_date: null }])
      .mockResolvedValueOnce([
        { client_count: 1, total_amount: '1', paid_amount: '0' },
      ]);

    const result = await service.findClients({});

    expect(result.items[0].lastPaymentDate).toBeNull();
  });

  it('meta cuenta clientes y totaliza sobre todos los clientes filtrados', async () => {
    const { meta } = await service.findClients({ page: 3, limit: 20 });

    expect(meta).toEqual({
      total: 41,
      page: 3,
      limit: 20,
      totalPages: 3,
      totals: {
        totalAmount: decimal('9000.50'),
        paidAmount: decimal('2000.25'),
        balance: decimal('7000.25'),
      },
    });
  });

  it('pagina sobre los grupos: limit y offset salen como parámetros', async () => {
    await service.findClients({ page: 3, limit: 20 });

    const [itemsCall] = prisma.$queryRaw.mock.calls;
    expect(itemsCall.slice(1)).toEqual(expect.arrayContaining([20, 40]));
  });

  it.each([
    ['with_balance', '> 0'],
    ['settled', '= 0'],
  ] as const)(
    'status=%s filtra con HAVING sobre el saldo sumado',
    async (status, operator) => {
      await service.findClients({ status });

      for (const call of prisma.$queryRaw.mock.calls) {
        expect(sqlOf(call)).toContain(
          `HAVING SUM(s.total_amount) - SUM(s.paid_amount) ${operator}`,
        );
      }
    },
  );

  it('sin status no aplica HAVING', async () => {
    await service.findClients({});

    for (const call of prisma.$queryRaw.mock.calls) {
      expect(sqlOf(call)).not.toContain('HAVING');
    }
  });

  it('search y fechas viajan como parámetros, no concatenados', async () => {
    await service.findClients({
      search: "x'; DROP TABLE y;--",
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    });

    const [itemsCall] = prisma.$queryRaw.mock.calls;
    const sql = sqlOf(itemsCall);
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).toContain('d.date >=');
    expect(sql).toContain('d.date <=');
    expect(Prisma.sql(itemsCall[0], ...itemsCall.slice(1)).values).toEqual(
      expect.arrayContaining([
        "x'; DROP TABLE y;--",
        '2026-09-01',
        '2026-09-30',
      ]),
    );
  });

  it('rechaza dateFrom posterior a dateTo', async () => {
    await expect(
      service.findClients({ dateFrom: '2026-10-01', dateTo: '2026-09-01' }),
    ).rejects.toThrow('dateFrom no puede ser posterior a dateTo');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('oldestPendingDays cuenta los días desde la fecha más antigua con saldo hasta hoy en Bogotá', async () => {
    prisma.$queryRaw.mockReset();
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          ...groupRow,
          oldest_pending_date: new Date(
            todayInBogota().getTime() - 45 * 24 * 60 * 60 * 1000,
          ),
        },
      ])
      .mockResolvedValueOnce([
        { client_count: 1, total_amount: '1', paid_amount: '0' },
      ]);

    const result = await service.findClients({});

    expect(result.items[0].oldestPendingDays).toBe(45);
  });

  it('oldestPendingDays es null si no hay facturas con saldo', async () => {
    prisma.$queryRaw.mockReset();
    prisma.$queryRaw
      .mockResolvedValueOnce([{ ...groupRow, oldest_pending_date: null }])
      .mockResolvedValueOnce([
        { client_count: 1, total_amount: '1', paid_amount: '0' },
      ]);

    const result = await service.findClients({});

    expect(result.items[0].oldestPendingDays).toBeNull();
  });

  it('la fecha más antigua solo considera facturas con saldo', async () => {
    await service.findClients({});

    expect(sqlOf(prisma.$queryRaw.mock.calls[0])).toContain(
      'FILTER (WHERE s.total_amount - s.paid_amount > 0)',
    );
  });

  it('sin sort ordena por último movimiento en el page y en el resultado final', async () => {
    await service.findClients({});

    const sql = sqlOf(prisma.$queryRaw.mock.calls[0]);
    expect(sql.match(/ORDER BY .+/g)).toEqual([
      'ORDER BY last_movement_at DESC, client_name ASC, client_id ASC',
      'ORDER BY last_movement_at DESC, client_name ASC, client_id ASC',
    ]);
  });

  it('sort=oldest_debt ordena por deuda más antigua (NULLS LAST) en el page y en el resultado final', async () => {
    await service.findClients({ sort: 'oldest_debt' });

    const sql = sqlOf(prisma.$queryRaw.mock.calls[0]);
    expect(sql.match(/ORDER BY .+/g)).toEqual([
      'ORDER BY oldest_pending_date ASC NULLS LAST, client_name ASC, client_id ASC',
      'ORDER BY oldest_pending_date ASC NULLS LAST, client_name ASC, client_id ASC',
    ]);
  });

  it('el DTO rechaza un sort desconocido y acepta los válidos', async () => {
    const errorsFor = (sort: string) =>
      validate(plainToInstance(FindReceivableClientsDto, { sort }));

    expect(await errorsFor('bogus')).toHaveLength(1);
    expect(await errorsFor('recent')).toHaveLength(0);
    expect(await errorsFor('oldest_debt')).toHaveLength(0);
  });
});
