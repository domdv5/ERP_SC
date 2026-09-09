import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DocumentType,
  EaiAdjustmentReason,
  MovementType,
} from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import { BaseEffectStrategy } from './base-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';
import { computeNewAvgCost } from '@/documents/helpers/stock.helpers';

/** Entrada por ajuste de inventario: suma stock y recalcula el costo promedio con el costo indicado en la línea. */
@Injectable()
export class EaiEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.EAI;

  async validateCreate(createDocumentDto: CreateDocumentDto) {
    if (
      createDocumentDto.items.some(
        (item) => item.unitCost == null || item.unitCost <= 0,
      )
    ) {
      throw new BadRequestException(
        'El costo unitario debe ser un valor mayor a cero',
      );
    }

    // El motivo es obligatorio para los reportes (ajuste del día a día vs. conteo
    // anual vs. traspaso de costo). El detalle libre solo es obligatorio si es "otro".
    if (!createDocumentDto.adjustmentReason) {
      throw new BadRequestException('El motivo del ajuste es obligatorio');
    }

    if (
      createDocumentDto.adjustmentReason === EaiAdjustmentReason.otro &&
      !createDocumentDto.adjustmentReasonOther?.trim()
    ) {
      throw new BadRequestException(
        'El detalle del motivo del ajuste es obligatorio cuando el motivo es "otro"',
      );
    }
  }

  async confirm(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    userId: string,
  ) {
    const warehouseId = this.requireWarehouse(document);

    // Vuelve a validar lo mismo que al crear: editar un borrador reemplaza los ítems
    // sin pasar por esa validación, así que confirmar es el único punto que ve el
    // estado final antes de aplicar los efectos (mismo motivo que en los traslados).
    if (document.documentItems.some((item) => Number(item.unitCost) <= 0)) {
      throw new BadRequestException(
        'El costo unitario debe ser un valor mayor a cero',
      );
    }

    if (!document.adjustmentReason) {
      throw new BadRequestException('El motivo del ajuste es obligatorio');
    }

    if (
      document.adjustmentReason === EaiAdjustmentReason.otro &&
      !document.adjustmentReasonOther?.trim()
    ) {
      throw new BadRequestException(
        'El detalle del motivo del ajuste es obligatorio cuando el motivo es "otro"',
      );
    }

    for (const item of document.documentItems) {
      const quantity = item.quantity;
      const unitCost = Number(item.unitCost);

      // Recalcula el costo promedio igual que en compras (sin tocar el último costo).
      const newAvgCost = await computeNewAvgCost(
        tx,
        item.productId,
        Number(item.product.avgCost),
        quantity,
        unitCost,
      );

      await tx.product.update({
        where: { id: item.productId },
        data: { avgCost: newAvgCost },
      });

      await this.moveStock(tx, {
        productId: item.productId,
        warehouseId,
        movementType: MovementType.adjustment,
        quantity,
        unitCost,
        documentId: document.id,
        documentItemId: item.id,
        userId,
      });
    }
  }
}
