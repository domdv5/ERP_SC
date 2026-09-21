import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, MovementType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import { BaseEffectStrategy } from './base-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';
import { assertSufficientStock } from '@/documents/helpers/stock.helpers';

/** Devolución a proveedor: resta stock y genera una nota crédito a favor. */
@Injectable()
export class DvcEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.DVC;

  async validateCreate(createDocumentDto: CreateDocumentDto) {
    await this.assertValidSupplier(createDocumentDto.thirdPartyId);

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: createDocumentDto.items.map((item) => item.productId) },
      },
      select: { id: true, brandId: true },
    });

    await this.assertItemsMatchSupplierBrands(
      createDocumentDto.thirdPartyId!,
      products.map((p) => ({ productId: p.id, brandId: p.brandId })),
    );
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

    // Chequeo extra: editar un borrador no vuelve a validar, así que un ítem de una
    // marca equivocada podría colarse si solo se revisara al crear.
    await this.assertItemsMatchSupplierBrands(
      supplier.id,
      document.documentItems.map((item) => ({
        productId: item.productId,
        brandId: item.product.brandId,
      })),
    );

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

    // Nota crédito de proveedor, aplicable a mano contra cualquier CxP pendiente; redondeada a pesos enteros (hasta ~1 peso de diferencia con el total).
    const amount = Math.round(Number(document.total));
    await tx.supplierCredit.create({
      data: {
        supplierId: supplier.id,
        sourceDocumentId: document.id,
        amount,
        balance: amount,
        status: 'available',
      },
    });
  }
}
