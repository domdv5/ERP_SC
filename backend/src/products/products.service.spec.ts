import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DocumentType } from '@/common/enums';
import { getReservedByProduct } from '@/documents/helpers/reservation.helpers';
import { ProductsService } from './products.service';

jest.mock('@/documents/helpers/reservation.helpers');

describe('ProductsService.findByCode', () => {
  const prisma = {
    product: { findFirst: jest.fn() },
    warehouse: { findMany: jest.fn() },
  };
  const service = new ProductsService(prisma as unknown as PrismaService);
  const reservedMock = jest.mocked(getReservedByProduct);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('availableStock = stock en bodegas activas - reservado PV - reservado REM', async () => {
    prisma.product.findFirst.mockResolvedValue({
      id: 'p1',
      code: 'A1',
      inventoryRecords: [
        { warehouseId: 'w1', quantity: 6 },
        { warehouseId: 'w2', quantity: 4 },
        { warehouseId: 'w-inactive', quantity: 99 },
      ],
    });
    prisma.warehouse.findMany.mockResolvedValue([
      { id: 'w1', name: 'Almacén' },
      { id: 'w2', name: 'Bodega' },
    ]);
    reservedMock.mockImplementation((_prisma, _ids, options) =>
      Promise.resolve(
        new Map([['p1', options?.types?.[0] === DocumentType.PV ? 3 : 2]]),
      ),
    );

    const result = await service.findByCode('a1');

    expect(result.availableStock).toBe(5);
    expect(result).not.toHaveProperty('inventoryRecords');
  });

  it('lanza 404 si el código no existe', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.findByCode('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
