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

// Los helpers de bulto corren fuera de transacción (validateCreate, this.prisma)
// y dentro (confirm, tx) — mismo patrón que reservation.helpers.ts.
type PrismaOrTx = PrismaService | Prisma.TransactionClient;

/** T — Traslado entre bodegas: salida del origen y entrada al destino (con bulto si aplica). */
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

    // Se revalida acá (no solo en validateCreate): un PATCH sobre el borrador
    // no vuelve a pasar por validateCreate, así que confirm() no puede asumirlo.

    if (!destWarehouseId) {
      throw new BadRequestException(
        'El traslado requiere bodegas de origen y destino distintas',
      );
    }

    const [sourceWarehouse, destWarehouse] = await Promise.all([
      tx.warehouse.findUnique({ where: { id: warehouseId } }),
      tx.warehouse.findUnique({ where: { id: destWarehouseId } }),
    ]);

    // Revalida también que el bulto sea obligatorio (no solo su pertenencia):
    // un PATCH puede quitar sourceBinId/destBinId sin pasar por validateCreate,
    // lo que antes dejaba confirmar sin bulto contra bodega bin-tracked y
    // rompía el invariante SUM(BinStock)===Inventory.
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

      // Lock sobre Bin (no BinStock, que puede no existir aún) para serializar
      // confirmaciones concurrentes al mismo bulto destino — sin esto, dos
      // traslados podrían ver el bulto libre a la vez y mezclar productos
      // distintos en él. Mismo patrón que registerPayment (SELECT...FOR UPDATE).
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

      // Salida de la bodega de origen.
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

      // Entrada a la bodega de destino.
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
   * Valida que el bulto destino exista, pertenezca a la bodega destino y no esté
   * ocupado por otro producto. Compartida entre validateCreate y confirm — el lock
   * FOR UPDATE que la hace segura contra carreras vive en el caller de confirm(),
   * ya que validateCreate no corre dentro de una transacción persistente.
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

    // Un bulto es contenedor físico de UN producto a la vez: acepta más del
    // mismo, pero no otro distinto mientras conserve stock. Antes esta regla
    // solo vivía en el filtro de UI (bin.occupied), sin defensa en el servidor.
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

  /** Valida que el bulto origen exista y pertenezca a la bodega origen — sin chequeo de "ocupado": a diferencia del destino, debe tener stock para poder salir de él. */
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
   * Si el traslado tiene bulto destino, todos los ítems deben compartir el mismo
   * productId (destBinId es del documento, no del ítem). Devuelve ese productId
   * para que el llamador lo compare contra lo que ya ocupa el bulto.
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
