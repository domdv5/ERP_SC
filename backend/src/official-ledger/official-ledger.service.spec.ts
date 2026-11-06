import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OfficialLedgerService } from './official-ledger.service';

describe('OfficialLedgerService.findProductMovements: fechas', () => {
  const prisma = {
    product: { findUnique: jest.fn() },
    documentItem: { findMany: jest.fn(), aggregate: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new OfficialLedgerService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((queries: unknown[]) =>
      Promise.all(queries),
    );
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      code: 'A',
      description: 'Producto',
    });
    prisma.documentItem.findMany.mockResolvedValue([]);
    prisma.documentItem.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
  });

  const beforeFilterOf = (call: number) =>
    prisma.documentItem.aggregate.mock.calls[call][0].where.document.date;

  it('el rango incluye el día dateTo y excluye el siguiente', async () => {
    await service.findProductMovements('p1', {
      dateFrom: '2026-03-01',
      dateTo: '2026-03-10',
    });

    const range = prisma.documentItem.findMany.mock.calls[0][0].where.document
      .date as { gte?: Date; lte?: Date; lt?: Date };
    const isInside = (day: string) => {
      const value = new Date(`${day}T00:00:00.000Z`).getTime();
      return (
        (!range.gte || value >= range.gte.getTime()) &&
        (!range.lte || value <= range.lte.getTime()) &&
        (!range.lt || value < range.lt.getTime())
      );
    };
    expect(isInside('2026-02-28')).toBe(false);
    expect(isInside('2026-03-01')).toBe(true);
    expect(isInside('2026-03-10')).toBe(true);
    expect(isInside('2026-03-11')).toBe(false);
  });

  it('el saldo inicial es estrictamente anterior a dateFrom (lt, no lte)', async () => {
    await service.findProductMovements('p1', { dateFrom: '2026-03-01' });

    expect(prisma.documentItem.aggregate).toHaveBeenCalledTimes(2);
    expect(beforeFilterOf(0)).toEqual({
      lt: new Date('2026-03-01T00:00:00.000Z'),
    });
    expect(beforeFilterOf(1)).toEqual({
      lt: new Date('2026-03-01T00:00:00.000Z'),
    });
  });

  it('sin dateFrom el corte del saldo inicial es la época Unix', async () => {
    await service.findProductMovements('p1', {});

    expect(beforeFilterOf(0)).toEqual({ lt: new Date(0) });
  });

  it('rechaza una fecha de calendario inexistente con el mismo mensaje', async () => {
    await expect(
      service.findProductMovements('p1', { dateFrom: '2026-02-30' }),
    ).rejects.toThrow(
      new BadRequestException('dateFrom no es una fecha válida'),
    );
    expect(prisma.product.findUnique).not.toHaveBeenCalled();
  });
});
