import { NotFoundException } from '@nestjs/common';
import { ThirdPartiesService } from './third-parties.service';
import type { PrismaService } from '@/prisma/prisma.service';

describe('ThirdPartiesService.findOne', () => {
  const findUnique = jest.fn();
  const service = new ThirdPartiesService({
    thirdParty: { findUnique },
  } as unknown as PrismaService);

  beforeEach(() => findUnique.mockReset());

  it('devuelve el tercero con sucursales y marcas activas', async () => {
    const row = { id: 'tp-1', name: 'Cliente' };
    findUnique.mockResolvedValue(row);

    await expect(service.findOne('tp-1')).resolves.toBe(row);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'tp-1' },
      include: {
        city: { include: { department: true } },
        customer: {
          include: {
            branches: {
              where: { active: true },
              orderBy: { name: 'asc' },
              include: { city: { include: { department: true } } },
            },
          },
        },
        supplier: { include: { brands: { where: { active: true } } } },
      },
    });
  });

  it('lanza 404 si no existe', async () => {
    findUnique.mockResolvedValue(null);

    const call = service.findOne('nope');
    await expect(call).rejects.toBeInstanceOf(NotFoundException);
    await expect(call).rejects.toThrow('Tercero no encontrado.');
  });
});
