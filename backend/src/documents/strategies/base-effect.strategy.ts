import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, MovementType } from '@/common/enums';
import { PrismaService } from '@/prisma/prisma.service';
import type {
  DocumentEffectStrategy,
  DocumentWithItems,
} from './document-effect.strategy';
import {
  applyBinStockChange,
  applyStockChange,
} from '@/documents/helpers/stock.helpers';

/**
 * Base de las estrategias de efectos: concentra la lógica compartida
 * (mover stock + registrar kardex, validar proveedor, exigir bodega)
 * para que cada estrategia solo describa lo propio de su tipo.
 */
@Injectable()
export abstract class BaseEffectStrategy implements DocumentEffectStrategy {
  abstract readonly type: DocumentType;

  constructor(protected readonly prisma: PrismaService) {}

  abstract confirm(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    userId: string,
  ): Promise<void>;

  protected requireWarehouse(document: { warehouseId: string | null }) {
    if (!document.warehouseId) {
      throw new BadRequestException('El documento no tiene bodega asignada');
    }

    return document.warehouseId;
  }

  protected async assertValidSupplier(thirdPartyId?: string) {
    const thirdParty = thirdPartyId
      ? await this.prisma.thirdParty.findUnique({
          where: { id: thirdPartyId },
          include: { supplier: true },
        })
      : null;

    if (!thirdParty?.supplier) {
      throw new BadRequestException(
        'El documento requiere un proveedor válido',
      );
    }
  }

  /**
   * Bloqueo duro: cada producto ya tiene una marca/proveedor fijos sin
   * ambigüedad, así que un ítem de una marca ajena al proveedor elegido
   * siempre es un error real (proveedor o producto equivocado), nunca un
   * caso legítimo a permitir con solo un aviso.
   */
  protected async assertItemsMatchSupplierBrands(
    supplierId: string,
    items: { productId: string; brandId: string }[],
  ) {
    const allowedBrandIds = new Set(
      (
        await this.prisma.brand.findMany({
          where: { supplierId, active: true },
          select: { id: true },
        })
      ).map((b) => b.id),
    );

    const invalid = items.filter((i) => !allowedBrandIds.has(i.brandId));
    if (invalid.length) {
      throw new BadRequestException(
        'Uno o más productos no pertenecen a las marcas del proveedor seleccionado',
      );
    }
  }

  /** Aplica el cambio de stock (Inventory) y registra el movimiento kardex. */
  protected async moveStock(
    tx: Prisma.TransactionClient,
    params: {
      productId: string;
      warehouseId: string;
      binId?: string | null;
      movementType: MovementType;
      /** Cantidad con signo: positiva entra, negativa sale. */
      quantity: number;
      unitCost: number;
      documentId: string;
      documentItemId: string;
      userId: string;
    },
  ) {
    const { previousStock, newStock } = await applyStockChange(tx, {
      productId: params.productId,
      warehouseId: params.warehouseId,
      delta: params.quantity,
    });

    if (params.binId) {
      await applyBinStockChange(tx, {
        productId: params.productId,
        binId: params.binId,
        warehouseId: params.warehouseId,
        delta: params.quantity,
      });
    }

    await tx.inventoryMovement.create({
      data: {
        productId: params.productId,
        warehouseId: params.warehouseId,
        binId: params.binId,
        movementType: params.movementType,
        quantity: params.quantity,
        unitCost: params.unitCost,
        previousStock,
        newStock,
        documentId: params.documentId,
        documentItemId: params.documentItemId,
        userId: params.userId,
      },
    });
  }
}
