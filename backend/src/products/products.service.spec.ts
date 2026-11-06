import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DocumentType } from '@/common/enums';
import { getReservedByProduct } from '@/documents/helpers/reservation.helpers';
import { ProductsService } from './products.service';

jest.mock('@/documents/helpers/reservation.helpers');

describe('ProductsService disponible', () => {
  const prisma = {
    product: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    warehouse: { findMany: jest.fn() },
    $transaction: jest.fn((queries: Promise<unknown>[]) =>
      Promise.all(queries),
    ),
  };
  const service = new ProductsService(prisma as unknown as PrismaService);
  const reservedMock = jest.mocked(getReservedByProduct);

  const productWithStock = {
    id: 'p1',
    code: 'A1',
    inventoryRecords: [
      { warehouseId: 'w1', quantity: 6 },
      { warehouseId: 'w2', quantity: 4 },
      { warehouseId: 'w-inactive', quantity: 99 },
    ],
  };

  // Almacén vende (store); Bodega solo almacena. PV reserva 3 y REM 2.
  function mockWarehousesAndReservations() {
    prisma.warehouse.findMany.mockResolvedValue([
      { id: 'w1', name: 'Almacén', type: 'store' },
      { id: 'w2', name: 'Bodega', type: 'warehouse' },
    ]);
    reservedMock.mockImplementation((_prisma, _ids, options) =>
      Promise.resolve(
        new Map([['p1', options?.types?.[0] === DocumentType.PV ? 3 : 2]]),
      ),
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((queries: Promise<unknown>[]) =>
      Promise.all(queries),
    );
  });

  it('availableStock = stock en bodegas activas - reservado PV - reservado REM', async () => {
    prisma.product.findFirst.mockResolvedValue(productWithStock);
    mockWarehousesAndReservations();

    const result = await service.findByCode('a1');

    expect(result.availableStock).toBe(5);
    expect(result).not.toHaveProperty('inventoryRecords');
    expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
  });

  it('availableToSell = stock solo del Almacén (tipo store) - reservado PV - reservado REM', async () => {
    prisma.product.findFirst.mockResolvedValue(productWithStock);
    mockWarehousesAndReservations();

    const result = await service.findByCode('a1');

    expect(result.availableToSell).toBe(1);
  });

  it('el listado trae availableToSell solo del Almacén y availableStock total', async () => {
    prisma.product.findMany.mockResolvedValue([productWithStock]);
    prisma.product.count.mockResolvedValue(1);
    mockWarehousesAndReservations();

    const result = await service.findAll({});

    expect(result.items[0].availableStock).toBe(5);
    expect(result.items[0].availableToSell).toBe(1);
  });

  it('lanza 404 si el código no existe', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.findByCode('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
