import { PrismaService } from '@/prisma/prisma.service';
import { ReportsService } from './reports.service';

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('ReportsService.getSalesBySeller', () => {
  const prisma = { $queryRaw: jest.fn() };
  const service = new ReportsService(prisma as unknown as PrismaService);
  const range = { from: day('2026-10-01'), to: day('2026-10-05') };

  const mockRows = (
    rows: unknown[],
    trend: { date: Date; netSales: number }[] = [],
  ) => {
    prisma.$queryRaw.mockReset();
    prisma.$queryRaw.mockResolvedValueOnce(rows).mockResolvedValueOnce(trend);
  };

  it('calcula netSales como ventas menos devoluciones y ordena de mayor a menor', async () => {
    mockRows([
      {
        sellerId: 'a',
        name: 'Ana',
        grossSales: 100,
        returns: 40,
        documentCount: 2,
      },
      {
        sellerId: 'b',
        name: 'Bea',
        grossSales: 90,
        returns: 0,
        documentCount: 3,
      },
      {
        sellerId: 'c',
        name: 'Cata',
        grossSales: 500,
        returns: 20.5,
        documentCount: 4,
      },
    ]);

    const { sellers } = await service.getSalesBySeller(range);

    expect(sellers.map((s) => [s.sellerId, s.netSales])).toEqual([
      ['c', 479.5],
      ['b', 90],
      ['a', 60],
    ]);
  });

  it('manda las devoluciones sin vendedora a unassignedReturns y no las lista como vendedora', async () => {
    mockRows([
      {
        sellerId: 'a',
        name: 'Ana',
        grossSales: 100,
        returns: 0,
        documentCount: 1,
      },
      {
        sellerId: null,
        name: null,
        grossSales: 0,
        returns: 35.25,
        documentCount: 0,
      },
    ]);

    const result = await service.getSalesBySeller(range);

    expect(result.unassignedReturns).toBe(35.25);
    expect(result.sellers).toHaveLength(1);
    expect(result.sellers[0].sellerId).toBe('a');
  });

  it('no pierde las ventas sin vendedora: van a unassignedSales', async () => {
    mockRows([
      {
        sellerId: null,
        name: null,
        grossSales: 100,
        returns: 20,
        documentCount: 1,
      },
    ]);

    const result = await service.getSalesBySeller(range);

    expect(result.unassignedSales).toBe(100);
    expect(result.unassignedReturns).toBe(20);
    expect(result.sellers).toEqual([]);
  });

  it('rellena con 0 los días sin ventas entre from y to inclusive', async () => {
    mockRows(
      [],
      [
        { date: day('2026-10-01'), netSales: 10 },
        { date: day('2026-10-04'), netSales: -5 },
      ],
    );

    const { trend } = await service.getSalesBySeller(range);

    expect(trend).toEqual([
      { date: '2026-10-01', netSales: 10 },
      { date: '2026-10-02', netSales: 0 },
      { date: '2026-10-03', netSales: 0 },
      { date: '2026-10-04', netSales: -5 },
      { date: '2026-10-05', netSales: 0 },
    ]);
  });
});

// Si alguien quita un ::float8/::int del SQL, Postgres manda texto (Decimal) o BigInt en vez de number.
describe('ReportsService: los totales salen como número aunque Postgres mande texto', () => {
  const prisma = { $queryRaw: jest.fn() };
  const service = new ReportsService(prisma as unknown as PrismaService);
  const range = { from: day('2026-10-01'), to: day('2026-10-01') };

  beforeEach(() => prisma.$queryRaw.mockReset());

  it('getInventory', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          warehouseId: 'w1',
          name: 'Almacén',
          units: '3',
          costValue: '10.50',
          productCount: BigInt(2),
        },
        {
          warehouseId: 'w2',
          name: 'Bodega',
          units: '4',
          costValue: '1.25',
          productCount: '1',
        },
      ])
      .mockResolvedValueOnce([{ productCount: BigInt(3) }]);

    const result = await service.getInventory();

    expect(result.warehouses[0]).toEqual({
      warehouseId: 'w1',
      name: 'Almacén',
      units: 3,
      costValue: 10.5,
      productCount: 2,
    });
    expect(result.totals).toEqual({
      units: 7,
      costValue: 11.75,
      productCount: 3,
    });
  });

  it('getRotation', async () => {
    const row = {
      productId: 'p1',
      code: 'A',
      description: 'Producto',
      unitsSold: '5',
      salesAmount: '99.90',
      stock: BigInt(8),
    };
    prisma.$queryRaw.mockResolvedValueOnce([row]).mockResolvedValueOnce([row]);

    const result = await service.getRotation(range, null, 10);

    const expected = { ...row, unitsSold: 5, salesAmount: 99.9, stock: 8 };
    expect(result).toEqual({ top: [expected], bottom: [expected] });
  });

  it('getAccounts', async () => {
    const totals = {
      total: '100.00',
      paid: '40',
      balance: '60',
      openCount: BigInt(2),
    };
    const balance = { thirdPartyId: 't1', name: 'Tercero', balance: '60.00' };
    prisma.$queryRaw
      .mockResolvedValueOnce([totals])
      .mockResolvedValueOnce([totals])
      .mockResolvedValueOnce([balance])
      .mockResolvedValueOnce([balance]);

    const result = await service.getAccounts(5);

    const expectedTotals = { total: 100, paid: 40, balance: 60, openCount: 2 };
    expect(result.payable).toEqual(expectedTotals);
    expect(result.receivable).toEqual(expectedTotals);
    expect(result.topSuppliers).toEqual([{ ...balance, balance: 60 }]);
    expect(result.topCustomers).toEqual([{ ...balance, balance: 60 }]);
  });

  it('getSalesBySeller', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          sellerId: 'a',
          name: 'Ana',
          grossSales: '100',
          returns: '40',
          documentCount: BigInt(2),
        },
        {
          sellerId: null,
          name: null,
          grossSales: '7',
          returns: '3',
          documentCount: BigInt(1),
        },
      ])
      .mockResolvedValueOnce([{ date: day('2026-10-01'), netSales: '60' }]);

    const result = await service.getSalesBySeller(range);

    expect(result).toEqual({
      sellers: [
        {
          sellerId: 'a',
          name: 'Ana',
          grossSales: 100,
          returns: 40,
          netSales: 60,
          documentCount: 2,
        },
      ],
      unassignedSales: 7,
      unassignedReturns: 3,
      trend: [{ date: '2026-10-01', netSales: 60 }],
    });
  });
});
