import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, MovementType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import { BaseEffectStrategy } from './base-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';
import { assertSufficientStock } from '@/documents/helpers/stock.helpers';

/** DVC — Devolución a proveedor: salida de stock y nota crédito en CxP. */
@Injectable()
export class DvcEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.DVC;

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
      const quantity = item.quantity;

      await assertSufficientStock(tx, item, warehouseId, quantity);

      await this.moveStock(tx, {
        productId: item.productId,
        warehouseId,
        movementType: MovementType.return,
        quantity: -quantity,
        unitCost: Number(item.unitCost),
        documentId: document.id,
        documentItemId: item.id,
        userId,
      });
    }

    // Nota crédito: monto negativo que reduce el saldo del proveedor.
    await tx.accountsPayable.create({
      data: {
        supplierId: supplier.id,
        documentId: document.id,
        totalAmount: -Number(document.total),
        status: 'pending',
      },
    });
  }
}
