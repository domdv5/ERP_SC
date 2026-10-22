import { LocationsService } from './locations.service';
import type { PrismaService } from '@/prisma/prisma.service';

describe('LocationsService', () => {
  const departmentFindMany = jest.fn();
  const cityFindMany = jest.fn();
  const service = new LocationsService({
    department: { findMany: departmentFindMany },
    city: { findMany: cityFindMany },
  } as unknown as PrismaService);

  it('lista departamentos por nombre', async () => {
    const rows = [{ code: '05', name: 'ANTIOQUIA' }];
    departmentFindMany.mockResolvedValue(rows);

    await expect(service.findDepartments()).resolves.toBe(rows);
    expect(departmentFindMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
  });

  it('lista solo las ciudades del departamento, por nombre', async () => {
    const rows = [{ code: '05001', name: 'MEDELLÍN' }];
    cityFindMany.mockResolvedValue(rows);

    await expect(service.findCities('05')).resolves.toBe(rows);
    expect(cityFindMany).toHaveBeenCalledWith({
      where: { departmentCode: '05' },
      select: { code: true, name: true },
      orderBy: { name: 'asc' },
    });
  });
});
