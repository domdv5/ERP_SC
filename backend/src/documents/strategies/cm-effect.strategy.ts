import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, MovementType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import { BaseEffectStrategy } from './base-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';
import { computeNewAvgCost } from './stock.helpers';

/** CM — Compra de mercancía: entrada de stock, re-ponderación de costos y CxP. */
@Injectable()
export class CmEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.CM;

  async validateCreate(createDocumentDto: CreateDocumentDto) {
    await this.assertValidSupplier(createDocumentDto.thirdPartyId);
  }

  async confirm(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    userId: string,
  ) {
    const warehouseId = this.requireWarehouse(document);
    const supplier = document.thirdParty?.supplier;

    if (!supplier) {
      throw new BadRequestException(
        'El documento requiere un proveedor válido',
      );
    }

    for (const item of document.documentItems) {
      const quantity = Number(item.quantity);
      const unitCost = Number(item.unitCost);

      // Costo ponderado sobre el stock global ANTES de la entrada.
      const newAvgCost = await computeNewAvgCost(
        tx,
        item.productId,
        Number(item.product.avgCost),
        quantity,
        unitCost,
      );

      await tx.product.update({
        where: { id: item.productId },
        data: { avgCost: newAvgCost, lastCost: unitCost },
      });

      await this.moveStock(tx, {
        productId: item.productId,
        warehouseId,
        movementType: MovementType.purchase,
        quantity,
        unitCost,
        documentId: document.id,
        documentItemId: item.id,
        userId,
      });
    }

    await tx.accountsPayable.create({
      data: {
        supplierId: supplier.id,
        documentId: document.id,
        totalAmount: document.total,
        status: 'pending',
      },
    });
  }
}
