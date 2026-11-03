import { ThirdPartiesService } from './third-parties.service';
import type { PrismaService } from '@/prisma/prisma.service';

describe('ThirdPartiesService.findAll — búsqueda', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const service = new ThirdPartiesService({
    thirdParty: { findMany, count },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  } as unknown as PrismaService);

  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([]);
    count.mockReset().mockResolvedValue(0);
  });

  it('busca por nombre, documento y marca activa del proveedor', async () => {
    await service.findAll({ search: 'nike', isSupplier: true });

    expect(findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      isSupplier: true,
      OR: [
        { name: { contains: 'nike', mode: 'insensitive' } },
        { documentNumber: { contains: 'nike', mode: 'insensitive' } },
        {
          supplier: {
            brands: {
              some: {
                active: true,
                name: { contains: 'nike', mode: 'insensitive' },
              },
            },
          },
        },
      ],
    });
  });

  it('sin búsqueda no filtra por texto', async () => {
    await service.findAll({ isSupplier: true });

    expect(findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      isSupplier: true,
    });
  });
});
