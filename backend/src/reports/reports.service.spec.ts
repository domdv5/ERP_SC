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
