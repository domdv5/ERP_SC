import { PrismaClient, WarehouseType } from '@prisma/client';

export async function seedWarehouses(prisma: PrismaClient) {
  const warehousesToSeed = [
    { name: 'Almacén', type: WarehouseType.store },
    { name: 'Bodega', type: WarehouseType.warehouse },
  ];

  for (const data of warehousesToSeed) {
    const existing = await prisma.warehouse.findFirst({ where: { name: data.name } });
    if (!existing) {
      await prisma.warehouse.create({ data });
    }
  }
}
