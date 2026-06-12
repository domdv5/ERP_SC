import { PrismaClient, WarehouseType } from '@prisma/client';

export async function seedWarehouses(prisma: PrismaClient) {
  await prisma.warehouse.createMany({
    data: [
      { name: 'Almacén', type: WarehouseType.store },
      { name: 'Bodega', type: WarehouseType.warehouse },
    ],
    skipDuplicates: true,
  });
}
