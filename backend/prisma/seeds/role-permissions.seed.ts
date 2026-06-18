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
      'document.read',
      'label.print',
      'thirdparty.create',
      'thirdparty.read',
      'thirdparty.update',
      'thirdparty.delete',
      'warehouse.manage',
      'ar.read',
      'ar.manage',
      'ap.read',
      'ap.manage',
      'cash.create',
      'cash.read',
      'user.manage',
    ],
    purchasing: [
      'product.create',
      'product.read',
      'product.update',
      'product.delete',
      'document.create.CM',
      'document.create.REM',
      'document.create.EAI',
      'document.create.SAJ',
      'document.read',
      'thirdparty.read',
      'thirdparty.create',
      'thirdparty.update',
      'thirdparty.delete',
      'ap.read',
      'ap.manage',
      'cash.read',
    ],
    warehouse: [
      'product.read',
      'document.read',
      'document.create.T',
      'thirdparty.read',
      'label.print',
      'warehouse.manage',
      'inventory.manage',
    ],
    basket_management: [
      'product.read',
      'document.create.POS', // Point of sale
      'document.read',
      'label.print',
      'warehouse.manage',
    ],
    billing: [
      'product.read',
      'document.create.DVC', // Sales invoice
      'document.create.RMDVC', // Sales invoice return
      'document.read',
      'thirdparty.read',
      'ar.read',
      'ar.manage',
      'cash.create',
      'cash.read',
    ],
    accounts_payable_admin: [
      'product.read',
      'document.read',
      'thirdparty.read',
      'thirdparty.create',
      'thirdparty.update',
      'ap.read',
      'ap.manage',
      'cash.read',
    ],
    accounts_receivable_admin: [
      'product.read',
      'document.read',
      'thirdparty.read',
      'thirdparty.create',
      'thirdparty.update',
      'ar.read',
      'ar.manage',
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
