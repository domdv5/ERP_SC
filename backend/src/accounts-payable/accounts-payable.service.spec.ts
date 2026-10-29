import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AccountsPayableService } from './accounts-payable.service';

describe('AccountsPayableService: orden de las CxP', () => {
  const prisma = {
    supplier: { findUnique: jest.fn() },
    accountsPayable: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    supplierCredit: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new AccountsPayableService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.accountsPayable.findMany.mockResolvedValue([]);
    prisma.supplierCredit.findMany.mockResolvedValue([]);
  });

  it('el listado ordena por último movimiento (compra o abono), el más reciente primero', async () => {
    prisma.$transaction.mockResolvedValue([
      [],
      0,
      { _sum: { totalAmount: null, paidAmount: null } },
    ]);

    await service.findAll({});

    expect(prisma.accountsPayable.findMany.mock.calls[0][0].orderBy).toEqual([
      { updatedAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('el estado de cuenta ordena por último movimiento, el más reciente primero', async () => {
    prisma.supplier.findUnique.mockResolvedValue({
      id: 's1',
      thirdParty: { id: 's1', name: 'Proveedor' },
    });

    await service.getSupplierStatement('s1');

    expect(prisma.accountsPayable.findMany.mock.calls[0][0].orderBy).toEqual([
      { updatedAt: 'desc' },
      { id: 'desc' },
    ]);
  });
});

const decimal = (value: string) => new Prisma.Decimal(value);

describe('AccountsPayableService.findSuppliers', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn((queries: unknown[]) => Promise.all(queries)),
  };
  const service = new AccountsPayableService(
    prisma as unknown as PrismaService,
  );
  const sqlOf = (call: unknown[]) =>
    Prisma.sql(call[0] as TemplateStringsArray, ...call.slice(1)).sql;

  const groupRow = {
    supplier_id: 's1',
    supplier_name: 'Proveedor Uno',
    payable_count: 3,
    total_amount: decimal('5000'),
    paid_amount: decimal('1250.5'),
    last_purchase_date: new Date('2026-09-01T00:00:00.000Z'),
    last_payment_date: new Date('2026-09-15T00:00:00.000Z'),
    last_movement_at: new Date('2026-09-16T15:00:00.000Z'),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((queries: unknown[]) =>
      Promise.all(queries),
    );
    prisma.$queryRaw.mockResolvedValueOnce([groupRow]).mockResolvedValueOnce([
      {
        supplier_count: 21,
        total_amount: decimal('8000'),
        paid_amount: decimal('3000.5'),
      },
    ]);
  });

  it('una fila por proveedor con saldo derivado y las fechas del grupo', async () => {
    const result = await service.findSuppliers({ page: 1, limit: 20 });

    expect(result.items).toEqual([
      {
        supplier: { id: 's1', name: 'Proveedor Uno' },
        payableCount: 3,
        totalAmount: decimal('5000'),
        paidAmount: decimal('1250.5'),
        balance: decimal('3749.5'),
        lastPurchaseDate: new Date('2026-09-01T00:00:00.000Z'),
        lastPaymentDate: new Date('2026-09-15T00:00:00.000Z'),
        lastMovementAt: new Date('2026-09-16T15:00:00.000Z'),
      },
    ]);
  });

  it('lastPaymentDate es null si el proveedor no tiene pagos', async () => {
    prisma.$queryRaw.mockReset();
    prisma.$queryRaw
      .mockResolvedValueOnce([{ ...groupRow, last_payment_date: null }])
      .mockResolvedValueOnce([
        { supplier_count: 1, total_amount: '1', paid_amount: '0' },
      ]);

    const result = await service.findSuppliers({});

    expect(result.items[0].lastPaymentDate).toBeNull();
  });

  it('la consulta de pagos cubre pagos históricos, egresos y créditos sin egreso', async () => {
    await service.findSuppliers({});

    const sql = sqlOf(prisma.$queryRaw.mock.calls[0]);
    expect(sql).toContain('payable_payments');
    expect(sql).toContain('egreso_allocation');
    expect(sql).toContain('sca.egreso_id IS NULL');
  });

  it('meta cuenta proveedores y totaliza sobre todos los proveedores filtrados', async () => {
    const { meta } = await service.findSuppliers({ page: 2, limit: 20 });

    expect(meta).toEqual({
      total: 21,
      page: 2,
      limit: 20,
      totalPages: 2,
      totals: {
        totalAmount: decimal('8000'),
        paidAmount: decimal('3000.5'),
        balance: decimal('4999.5'),
      },
    });
  });

  it.each([
    ['with_balance', '> 0'],
    ['settled', '= 0'],
  ] as const)(
    'status=%s filtra con HAVING sobre el saldo sumado',
    async (status, operator) => {
      await service.findSuppliers({ status });

      for (const call of prisma.$queryRaw.mock.calls) {
        expect(sqlOf(call)).toContain(
          `HAVING SUM(s.total_amount) - SUM(s.paid_amount) ${operator}`,
        );
      }
    },
  );

  it('sin status no aplica HAVING', async () => {
    await service.findSuppliers({});

    for (const call of prisma.$queryRaw.mock.calls) {
      expect(sqlOf(call)).not.toContain('HAVING');
    }
  });

  it('rechaza dateFrom posterior a dateTo', async () => {
    await expect(
      service.findSuppliers({ dateFrom: '2026-10-01', dateTo: '2026-09-01' }),
    ).rejects.toThrow('dateFrom no puede ser posterior a dateTo');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
