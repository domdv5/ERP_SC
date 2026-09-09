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
import { getReservedByProduct } from '@/documents/helpers/reservation.helpers';

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

  /** Bloqueo total: la marca y el proveedor de un producto son fijos, así que un ítem de otra marca siempre es un error real, nunca un caso a permitir con solo aviso. */
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

  /** Bloqueo total: vender por debajo del precio mínimo del producto siempre es un error real. Junta todos los casos (no corta en el primero) para poder corregir el documento entero de una vez. */
  protected assertPricesAboveFloor(
    items: { code: string; unitPrice: number; minSalePrice: number }[],
  ) {
    const violations = items.filter(
      (item) => Number(item.unitPrice) < item.minSalePrice,
    );

    if (violations.length > 0) {
      const detail = violations
        .map(
          (v) => `${v.code} (precio ${v.unitPrice}, mínimo ${v.minSalePrice})`,
        )
        .join(', ');
      throw new BadRequestException(
        `Uno o más productos tienen un precio de venta por debajo del mínimo permitido: ${detail}`,
      );
    }
  }

  /**
   * Valida el disponible (stock menos reservas) de todos los ítems en una sola consulta
   * que bloquea las filas, evitando muchas consultas sueltas y que dos confirmaciones a la
   * vez lean el mismo disponible antes de escribir. Junta los faltantes y los devuelve en
   * vez de lanzar: cada llamador arma su mensaje (la preventa corta en el primero, la venta
   * de contado los reporta todos juntos).
   */
  protected async assertBatchAvailability(
    tx: Prisma.TransactionClient,
    warehouseId: string,
    items: { productId: string; quantity: number; product: { code: string } }[],
    options?: { excludeDocumentId?: string },
  ): Promise<
    { productId: string; code: string; available: number; requested: number }[]
  > {
    const productIds = items.map((item) => item.productId);

    const [reservedMap, inventoryRows] = await Promise.all([
      getReservedByProduct(tx, productIds, {
        excludeDocumentId: options?.excludeDocumentId,
      }),
      tx.$queryRaw<{ product_id: string; quantity: number }[]>`
        SELECT product_id, quantity FROM inventory
        WHERE product_id = ANY(${productIds}::uuid[]) AND warehouse_id = ${warehouseId}::uuid
        ORDER BY product_id
        FOR UPDATE
      `,
    ]);

    const stockByProduct = new Map(
      inventoryRows.map((row) => [row.product_id, row.quantity]),
    );

    const shortfalls: {
      productId: string;
      code: string;
      available: number;
      requested: number;
    }[] = [];

    for (const item of items) {
      const totalStock = stockByProduct.get(item.productId) ?? 0;
      const reserved = reservedMap.get(item.productId) ?? 0;
      const available = totalStock - reserved;

      if (available < item.quantity) {
        shortfalls.push({
          productId: item.productId,
          code: item.product.code,
          available,
          requested: item.quantity,
        });
      }
    }

    return shortfalls;
  }

  /** Aplica el cambio de stock en el inventario y registra el movimiento en el kardex. */
  protected async moveStock(
    tx: Prisma.TransactionClient,
    params: {
      productId: string;
      warehouseId: string;
      binId?: string | null;
      movementType: MovementType;
      /** Cantidad con signo: positiva suma stock, negativa lo resta. */
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
