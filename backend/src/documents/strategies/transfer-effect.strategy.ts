import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, MovementType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import type { PrismaService } from '@/prisma/prisma.service';
import { BaseEffectStrategy } from './base-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';
import {
  assertSufficientBinStock,
  assertSufficientStock,
} from '@/documents/helpers/stock.helpers';

// Los helpers de bulto se usan tanto fuera de una transacción (al validar la
// creación) como dentro (al confirmar), igual que los helpers de reserva.
type PrismaOrTx = PrismaService | Prisma.TransactionClient;

/** Traslado entre bodegas: salida de la bodega origen y entrada en la destino (con bulto si aplica). */
@Injectable()
export class TransferEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.T;

  async validateCreate(createDocumentDto: CreateDocumentDto) {
    const { warehouseId, destWarehouseId, destBinId, sourceBinId } =
      createDocumentDto;

    if (!warehouseId || !destWarehouseId || warehouseId === destWarehouseId) {
      throw new BadRequestException(
        'El traslado requiere bodegas de origen y destino distintas',
      );
    }

    const destWarehouse = await this.prisma.warehouse.findUnique({
      where: { id: destWarehouseId },
    });

    if (!destWarehouse) {
      throw new BadRequestException('La bodega de destino no existe');
    }

    if (destWarehouse.type === 'warehouse' && !destBinId) {
      throw new BadRequestException(
        'Los traslados hacia bodega requieren un bulto destino',
      );
    }

    if (destBinId) {
      const incomingProductId = this.assertSingleProductPerDestBin(createDocumentDto.items);
      await this.assertDestBinValid(this.prisma, destBinId, destWarehouseId, incomingProductId);
    }

    const sourceWarehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!sourceWarehouse) {
      throw new BadRequestException('La bodega de origen no existe');
    }

    if (sourceWarehouse.type === 'warehouse' && !sourceBinId) {
      throw new BadRequestException(
        'Los traslados desde bodega requieren un bulto origen',
      );
    }

    if (sourceBinId) {
      await this.assertSourceBinValid(this.prisma, sourceBinId, warehouseId);
    }
  }

  async confirm(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    userId: string,
  ) {
    const warehouseId = this.requireWarehouse(document);
    const { destWarehouseId, destBinId, sourceBinId } = document;

    // Se vuelve a validar acá (no solo al crear): editar el borrador no pasa por
    // esa validación, así que confirmar no puede darla por hecha.

    if (!destWarehouseId) {
      throw new BadRequestException(
        'El traslado requiere bodegas de origen y destino distintas',
      );
    }

    const [sourceWarehouse, destWarehouse] = await Promise.all([
      tx.warehouse.findUnique({ where: { id: warehouseId } }),
      tx.warehouse.findUnique({ where: { id: destWarehouseId } }),
    ]);

    // Vuelve a comprobar que el bulto sea obligatorio (no solo que pertenezca a la
    // bodega): al editar un borrador se puede borrar el bulto de origen o destino
    // sin pasar por la validación de creación, lo que antes dejaba confirmar sin
    // bulto contra una bodega que sí lleva bultos y descuadraba el inventario.
    if (sourceWarehouse?.type === 'warehouse' && !sourceBinId) {
      throw new BadRequestException(
        'Los traslados desde bodega requieren un bulto origen',
      );
    }

    if (destWarehouse?.type === 'warehouse' && !destBinId) {
      throw new BadRequestException(
        'Los traslados hacia bodega requieren un bulto destino',
      );
    }

    if (destBinId) {
      const incomingProductId = this.assertSingleProductPerDestBin(document.documentItems);

      // Bloquea el bulto (no su stock, que puede no existir aún) para poner en fila
      // las confirmaciones a la vez sobre el mismo bulto destino: sin esto, dos
      // traslados podrían verlo libre al mismo tiempo y mezclarle productos distintos.
      await tx.$queryRaw`SELECT id FROM bin WHERE id = ${destBinId}::uuid FOR UPDATE`;
      await this.assertDestBinValid(tx, destBinId, destWarehouseId, incomingProductId);
    }

    if (sourceBinId) {
      await this.assertSourceBinValid(tx, sourceBinId, warehouseId);
    }

    for (const item of document.documentItems) {
      const quantity = item.quantity;
      const unitCost = Number(item.product.avgCost);

      await assertSufficientStock(tx, item, warehouseId, quantity);

      if (sourceBinId) {
        await assertSufficientBinStock(tx, item, sourceBinId, quantity);
      }

      // Salida de la bodega origen.
      await this.moveStock(tx, {
        productId: item.productId,
        warehouseId,
        binId: sourceBinId,
        movementType: MovementType.transfer,
        quantity: -quantity,
        unitCost,
        documentId: document.id,
        documentItemId: item.id,
        userId,
      });

      // Entrada en la bodega destino.
      await this.moveStock(tx, {
        productId: item.productId,
        warehouseId: destWarehouseId,
        binId: destBinId,
        movementType: MovementType.transfer,
        quantity,
        unitCost,
        documentId: document.id,
        documentItemId: item.id,
        userId,
      });
    }
  }

  /**
   * Verifica que el bulto destino exista, pertenezca a la bodega destino y no esté
   * ocupado por otro producto. Se usa al crear y al confirmar; el bloqueo que la
   * hace segura contra carreras lo pone quien llama a confirmar, porque la
   * validación de creación no corre dentro de una transacción.
   */
  private async assertDestBinValid(
    client: PrismaOrTx,
    destBinId: string,
    destWarehouseId: string,
    incomingProductId: string,
  ): Promise<void> {
    const bin = await client.bin.findUnique({
      where: { id: destBinId },
      include: { zone: { select: { warehouseId: true } } },
    });

    if (!bin || bin.zone.warehouseId !== destWarehouseId) {
      throw new BadRequestException(
        'El bulto destino no pertenece a la bodega de destino seleccionada',
      );
    }

    // Un bulto es un contenedor físico de UN producto a la vez: acepta más del
    // mismo, pero no otro distinto mientras conserve stock. Antes esta regla solo
    // vivía en el filtro de la interfaz, sin control en el servidor.
    const conflictingBinStock = await client.binStock.findFirst({
      where: {
        binId: destBinId,
        quantity: { gt: 0 },
        productId: { not: incomingProductId },
      },
      include: { product: { select: { code: true } } },
    });

    if (conflictingBinStock) {
      throw new BadRequestException(
        `El bulto destino ya contiene el producto ${conflictingBinStock.product.code} — no puede recibir un producto distinto hasta vaciarse`,
      );
    }
  }

  /** Verifica que el bulto origen exista y pertenezca a la bodega origen. No comprueba si está "ocupado": a diferencia del destino, tiene que tener stock para poder sacar de él. */
  private async assertSourceBinValid(
    client: PrismaOrTx,
    sourceBinId: string,
    warehouseId: string,
  ): Promise<void> {
    const bin = await client.bin.findUnique({
      where: { id: sourceBinId },
      include: { zone: { select: { warehouseId: true } } },
    });

    if (!bin || bin.zone.warehouseId !== warehouseId) {
      throw new BadRequestException(
        'El bulto origen no pertenece a la bodega de origen seleccionada',
      );
    }
  }

  /**
   * Si el traslado tiene bulto destino, todos los ítems deben ser del mismo
   * producto (el bulto destino es del documento, no de cada línea). Devuelve ese
   * producto para que quien llama lo compare contra lo que ya ocupa el bulto.
   */
  private assertSingleProductPerDestBin(items: { productId: string }[]): string {
    const productIds = new Set(items.map((item) => item.productId));

    if (productIds.size > 1) {
      throw new BadRequestException(
        'Un traslado hacia un bulto solo puede contener un único producto',
      );
    }

    return items[0].productId;
  }
}
