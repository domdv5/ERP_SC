import { PrismaClient } from '@prisma/client';

export async function seedRoles(prisma: PrismaClient) {
  await prisma.role.createMany({
    data: [
      {
        name: 'admin',
        description: 'no tengo',
      },
      {
        name: 'seller',
        description: 'no tengo',
      },
      {
        name: 'warehouse_manager',
        description: 'no tengo',
      },
      {
        name: 'accountant',
        description: 'no tengo',
      },
    ],
    skipDuplicates: true,
  });
}
