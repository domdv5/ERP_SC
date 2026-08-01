import { PrismaClient } from '@prisma/client';

export async function seedRoles(prisma: PrismaClient) {
  await prisma.role.createMany({
    data: [
      {
        name: 'admin',
        description: 'Full system access',
      },

      {
        name: 'purchasing',
        description: 'Manages purchases and supplier orders',
      },

      {
        name: 'warehouse',
        description: 'Manages inventory and warehouse operations',
      },

      {
        name: 'basket_management',
        description: 'Manages product baskets and packaging',
      },

      {
        name: 'billing',
        description: 'Handles invoicing and sales billing',
      },

      {
        name: 'accounts_admin',
        description: 'Manages accounts payable, accounts receivable, and system users',
      },

      {
        name: 'accounts_assistant',
        description: 'Manages accounts payable and accounts receivable',
      },
    ],

    skipDuplicates: true,
  });
}
