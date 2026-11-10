import { PrismaClient } from '@prisma/client';

const BILLING_PERMISSIONS = [
  'product.read',
  'thirdparty.read',
  'thirdparty.create',
  'thirdparty.update',
  'thirdparty.role.customer',
  'document.read',
  'document.create.POS',
  'document.create.COT',
  'document.create.REM',
  'document.create.DVV',
  'document.convert.PV',
  'document.convert.REM',
  'cash.create',
  'cash.read',
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
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
    'document.create.CMO',
    'document.create.POSO',
    'document.release.PV',
    'document.convert.PV',
    'document.release.REM',
    'document.convert.REM',
    'document.void.POS',
    'document.void.COT',
    'document.void.POSO',
    'document.void.REM',
    'document.read',
    'label.print',
    'thirdparty.create',
    'thirdparty.read',
    'thirdparty.update',
    'thirdparty.delete',
    'thirdparty.role.customer',
    'thirdparty.role.supplier',
    'thirdparty.role.seller',
    'thirdparty.role.receiver',
    'customer.credit.update',
    'warehouse.manage',
    'inventory.manage',
    'ar.read',
    'ar.manage',
    'ap.read',
    'ap.manage',
    'egreso.read',
    'egreso.create',
    'recibo.read',
    'recibo.create',
    'excedente.create',
    'official.read',
    'inventory_case.read',
    'inventory_case.close',
    'inventory_case.reopen',
    'cash.create',
    'cash.read',
    'user.manage',
    'system.manage',
    'report.read',
  ],
  inventory_manager: [
    'product.read',
    'document.read',
    'inventory_case.read',
    'inventory_case.close',
  ],
  purchasing: [
    'product.read',
    'product.create',
    'product.update',
    'thirdparty.read',
    'thirdparty.create',
    'thirdparty.update',
    'thirdparty.role.customer',
    'thirdparty.role.supplier',
    'thirdparty.role.seller',
    'thirdparty.role.receiver',
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
  billing: BILLING_PERMISSIONS,
  // Líder de facturación = facturación + M2 (POSO); hereda la lista para que no se desincronicen
  billing_lead: [...BILLING_PERMISSIONS, 'document.create.POSO'],
  accounts_admin: [
    'product.read',
    'product.create',
    'product.update',
    'thirdparty.read',
    'thirdparty.create',
    'thirdparty.update',
    'thirdparty.role.customer',
    'thirdparty.role.supplier',
    'thirdparty.role.seller',
    'thirdparty.role.receiver',
    'customer.credit.update',
    'document.read',
    'document.create.CMO',
    'document.void.POS',
    'document.void.COT',
    'document.void.POSO',
    'document.void.REM',
    'official.read',
    'ar.read',
    'ar.manage',
    'ap.read',
    'ap.manage',
    'egreso.read',
    'egreso.create',
    'recibo.read',
    'recibo.create',
    'excedente.create',
    'cash.read',
    'user.manage',
    'system.manage',
  ],
};

export async function seedRolePermissions(prisma: PrismaClient) {
  // Obtener todos los roles y permisos
  const roles = await prisma.role.findMany();
  const permissions = await prisma.permission.findMany();

  // Crear un mapa de permisos por código para acceso rápido
  const permissionMap = new Map(permissions.map((p) => [p.code, p.id]));

  // Reemplazar por completo los permisos de cada rol (delete + create)
  for (const role of roles) {
    const permissionCodes = ROLE_PERMISSIONS[role.name] || [];

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
