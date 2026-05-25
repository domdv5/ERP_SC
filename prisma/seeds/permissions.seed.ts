import { PrismaClient } from '@prisma/client';

const permissions = [
  {
    code: 'all.manage',
    module: 'all',
    description: 'Permite administrar todos los recursos',
  },
  {
    code: 'auth.read',
    module: 'auth',
    description: 'Permite consultar usuarios/autenticacion',
  },
];

export async function seedPermissions(prisma: PrismaClient) {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: permission,
      create: permission,
    });
  }

  const adminRole = await prisma.role.findUnique({
    where: { name: 'admin' },
    select: { id: true },
  });

  const adminPermission = await prisma.permission.findUnique({
    where: { code: 'all.manage' },
    select: { id: true },
  });

  if (!adminRole || !adminPermission) return;

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: adminRole.id,
        permissionId: adminPermission.id,
      },
    },
    update: {},
    create: {
      roleId: adminRole.id,
      permissionId: adminPermission.id,
    },
  });
}
