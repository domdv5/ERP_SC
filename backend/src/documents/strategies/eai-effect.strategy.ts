import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, MovementType } from '@/common/enums';
import { BaseEffectStrategy } from './base-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';
import { computeNewAvgCost } from '@/documents/helpers/stock.helpers';

/** EAI — Entrada por ajuste de inventario: suma stock; re-pondera costo si trae unitCost. */
@Injectable()
export class EaiEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.EAI;

  async confirm(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    userId: string,
  ) {
    const warehouseId = this.requireWarehouse(document);

    for (const item of document.documentItems) {
      const quantity = Number(item.quantity);
      const itemUnitCost = Number(item.unitCost);
      const hasUnitCost = itemUnitCost > 0;
      const unitCost = hasUnitCost
        ? itemUnitCost
        : Number(item.product.avgCost);

      if (hasUnitCost) {
        // Re-ponderar avgCost igual que en compras (sin tocar lastCost).
        const newAvgCost = await computeNewAvgCost(
          tx,
          item.productId,
          Number(item.product.avgCost),
          quantity,
          itemUnitCost,
        );

        await tx.product.update({
          where: { id: item.productId },
          data: { avgCost: newAvgCost },
        });
      }

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
