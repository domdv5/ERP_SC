import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, MovementType } from '@/common/enums';
import { BaseEffectStrategy } from './base-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';
import { assertSufficientStock } from '@/documents/helpers/stock.helpers';

/** Salida por ajuste de inventario: resta stock, valorado al costo promedio actual. */
@Injectable()
export class SajEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.SAJ;

  async confirm(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    userId: string,
  ) {
    const warehouseId = this.requireWarehouse(document);

    for (const item of document.documentItems) {
      const quantity = item.quantity;

      await assertSufficientStock(tx, item, warehouseId, quantity);

      // Ignora el costo escrito en la línea (a diferencia de la entrada por ajuste):
      // la salida siempre se valora al costo promedio actual, nunca a uno tipeado.
      await this.moveStock(tx, {
        productId: item.productId,
        warehouseId,
        movementType: MovementType.adjustment,
        quantity: -quantity,
        unitCost: Number(item.product.avgCost),
        documentId: document.id,
        documentItemId: item.id,
        userId,
      });
    }
  }
}
