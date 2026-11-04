import { PrismaClient } from '@prisma/client';

export async function seedRoles(prisma: PrismaClient) {
  // El seed usa createMany+skipDuplicates y no puede renombrar una fila ya
  // existente. Renombramos en el lugar para conservar las asignaciones de
  // usuario (UserRole) que apuntan al rol por id.
  await prisma.role.updateMany({
    where: { name: 'basket_management' },
    data: {
      name: 'preventa',
      description: 'Gestión de preventas y reservas de stock',
    },
  });

  // Rol eliminado (2026-11-04): el seed no borra filas solo, se quitan con sus permisos y asignaciones
  const removedRole = { role: { name: 'accounts_assistant' } };
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: removedRole }),
    prisma.rolePermission.deleteMany({ where: removedRole }),
    prisma.role.deleteMany({ where: { name: 'accounts_assistant' } }),
  ]);

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
        name: 'preventa',
        description: 'Gestión de preventas y reservas de stock',
      },

      {
        name: 'billing',
        description: 'Handles invoicing and sales billing',
      },

      {
        name: 'accounts_admin',
        description:
          'Manages accounts payable, accounts receivable, and system users',
      },
    ],

    skipDuplicates: true,
  });
}
