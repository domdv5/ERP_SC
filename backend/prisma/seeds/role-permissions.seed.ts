import { PrismaClient } from '@prisma/client';

export async function seedRolePermissions(prisma: PrismaClient) {
  // Obtener todos los roles y permisos
  const roles = await prisma.role.findMany();
  const permissions = await prisma.permission.findMany();

  // Crear un mapa de permisos por código para acceso rápido
  const permissionMap = new Map(permissions.map((p) => [p.code, p.id]));

  // Definir qué permisos tiene cada rol
  const rolePermissions: Record<string, string[]> = {
    admin: [
      // Admin tiene acceso a todo
      'product.create',
      'product.read',
      'product.update',
      'product.delete',
      'document.create.CM',
      'document.create.DVC',
      'document.create.RMDVC',
      'document.create.PE',
      'document.create.EAI',
      'document.create.SAJ',
      'document.create.COT',
      'document.create.POS',
      'document.create.REM',
      'document.create.DVV',
      'document.create.T',
      'document.create.PV',
      'document.release.PV',
      'document.convert.PV',
      'document.release.REM',
      'document.convert.REM',
      'document.read',
      'label.print',
      'thirdparty.create',
      'thirdparty.read',
      'thirdparty.update',
      'thirdparty.delete',
      'warehouse.manage',
      'inventory.manage',
      'ar.read',
      'ar.manage',
      'ap.read',
      'ap.manage',
      'cash.create',
      'cash.read',
      'user.manage',
      'system.manage',
    ],
    purchasing: [
      'product.read',
      'product.create',
      'product.update',
      'thirdparty.read',
      'thirdparty.create',
      'thirdparty.update',
      'document.read',
      'document.create.CM',
      'document.create.DVC',
      'document.create.EAI',
      'document.create.SAJ',
      'inventory.manage',
      'cash.read',
    ],
    warehouse: [
      'product.read',
      'thirdparty.read',
      'document.read',
      'document.create.T',
      'warehouse.manage',
      'inventory.manage',
      'label.print',
    ],
    preventa: [
      'product.read',
      'thirdparty.read',
      'document.read',
      'document.create.PV',
      'document.release.PV',
      'document.convert.PV',
      'inventory.manage',
    ],
    billing: [
      'product.read',
      'thirdparty.read',
      'thirdparty.create',
      'thirdparty.update',
      'document.read',
      'document.create.POS',
      'document.create.COT',
      'document.create.REM',
      'document.convert.REM',
      'cash.create',
      'cash.read',
    ],
    accounts_admin: [
      'product.read',
      'product.create',
      'product.update',
      'thirdparty.read',
      'thirdparty.create',
      'thirdparty.update',
      'document.read',
      'document.create.CM',
      'document.create.DVC',
      'ar.read',
      'ar.manage',
      'ap.read',
      'ap.manage',
      'cash.read',
      'user.manage',
      'system.manage',
    ],
    accounts_assistant: [
      'product.read',
      'product.create',
      'product.update',
      'thirdparty.read',
      'thirdparty.create',
      'thirdparty.update',
      'document.read',
      'document.create.CM',
      'document.create.DVC',
      'ar.read',
      'ar.manage',
      'ap.read',
      'ap.manage',
      'cash.read',
    ],
  };

  // Reemplazar por completo los permisos de cada rol (delete + create)
  for (const role of roles) {
    const permissionCodes = rolePermissions[role.name] || [];

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    for (const code of permissionCodes) {
      const permissionId = permissionMap.get(code);
      if (permissionId) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId },
        });
      }
    }
  }
}
