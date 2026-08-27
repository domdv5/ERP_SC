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

    // Defensa en profundidad: update() no revalida un borrador editado, así que
    // un ítem de marca equivocada podría colarse si solo se validara en validateCreate.
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

    // Nota crédito de proveedor: saldo a favor aplicable manualmente contra
    // cualquier cuenta por pagar pendiente de este proveedor (ver Plan 020).
    // Redondeado a pesos enteros: el sistema trata COP sin centavos (formatCOP,
    // input de pago entero) — no debe nacer con saldo fraccionario aplicable.
    // document.total se deja exacto; se acepta un delta de hasta ~1 peso.
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
