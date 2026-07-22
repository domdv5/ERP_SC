import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, MovementType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import { BaseEffectStrategy } from './base-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';
import {
  assertSufficientBinStock,
  assertSufficientStock,
} from '@/documents/helpers/stock.helpers';

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
      const bin = await this.prisma.bin.findUnique({
        where: { id: destBinId },
        include: { zone: { select: { warehouseId: true } } },
      });

      if (!bin) {
        throw new BadRequestException('El bulto destino no existe');
      }

      if (bin.zone.warehouseId !== destWarehouseId) {
        throw new BadRequestException(
          'El bulto destino no pertenece a la bodega de destino seleccionada',
        );
      }
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
      const bin = await this.prisma.bin.findUnique({
        where: { id: sourceBinId },
        include: { zone: { select: { warehouseId: true } } },
      });

      if (!bin) {
        throw new BadRequestException('El bulto origen no existe');
      }

      if (bin.zone.warehouseId !== warehouseId) {
        throw new BadRequestException(
          'El bulto origen no pertenece a la bodega de origen seleccionada',
        );
      }
    }
  }

  async confirm(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    userId: string,
  ) {
    const warehouseId = this.requireWarehouse(document);
    const { destWarehouseId, destBinId, sourceBinId } = document;

    // Se revalida bin/bodega acá, no solo en validateCreate: un borrador se
    // puede editar (PATCH) sin volver a pasar por validateCreate, así que
    // confirm() no puede asumir que la consistencia sigue vigente.

    if (!destWarehouseId) {
      throw new BadRequestException(
        'El traslado requiere bodegas de origen y destino distintas',
      );
    }

    if (destBinId) {
      const bin = await tx.bin.findUnique({
        where: { id: destBinId },
        include: { zone: { select: { warehouseId: true } } },
      });

      if (!bin || bin.zone.warehouseId !== destWarehouseId) {
        throw new BadRequestException(
          'El bulto destino no pertenece a la bodega de destino seleccionada',
        );
      }
    }

    if (sourceBinId) {
      const bin = await tx.bin.findUnique({
        where: { id: sourceBinId },
        include: { zone: { select: { warehouseId: true } } },
      });

      if (!bin || bin.zone.warehouseId !== warehouseId) {
        throw new BadRequestException(
          'El bulto origen no pertenece a la bodega de origen seleccionada',
        );
      }
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
}
