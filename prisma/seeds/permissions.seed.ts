import { PrismaClient } from '@prisma/client';

export async function seedPermissions(prisma: PrismaClient) {
  await prisma.permission.createMany({
    data: [
      // Productos
      { code: 'product.create', module: 'products' },
      { code: 'product.read', module: 'products' },
      { code: 'product.update', module: 'products' },
      { code: 'product.delete', module: 'products' },

      // Documentos — separados por tipo porque cada rol crea tipos distintos
      { code: 'document.create.CM', module: 'documents' },
      { code: 'document.create.DVC', module: 'documents' },
      { code: 'document.create.RMDVC', module: 'documents' },
      { code: 'document.create.PE', module: 'documents' },
      { code: 'document.create.EAI', module: 'documents' },
      { code: 'document.create.SAJ', module: 'documents' },
      { code: 'document.create.COT', module: 'documents' },
      { code: 'document.create.POS', module: 'documents' },
      { code: 'document.create.REM', module: 'documents' },
      { code: 'document.create.DVV', module: 'documents' },
      { code: 'document.create.T', module: 'documents' },
      { code: 'document.read', module: 'documents' },

      // Etiquetas
      { code: 'label.print', module: 'labels' },

      // Terceros (proveedores y clientes)
      { code: 'thirdparty.create', module: 'third-parties' },
      { code: 'thirdparty.read', module: 'third-parties' },
      { code: 'thirdparty.update', module: 'third-parties' },
      { code: 'thirdparty.delete', module: 'third-parties' },

      // Bodegas — manage porque solo bodega las gestiona completamente
      { code: 'warehouse.manage', module: 'warehouses' },

      // Cuentas por cobrar
      { code: 'ar.read', module: 'accounts' },
      { code: 'ar.manage', module: 'accounts' },

      // Cuentas por pagar
      { code: 'ap.read', module: 'accounts' },
      { code: 'ap.manage', module: 'accounts' },

      // Caja
      { code: 'cash.create', module: 'cash' },
      { code: 'cash.read', module: 'cash' },

      // Usuarios — solo admin
      { code: 'user.manage', module: 'users' },
    ],
    skipDuplicates: true,
  });
}
