import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, MovementType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import { BaseEffectStrategy } from './base-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';
import { computeNewAvgCost } from '@/documents/helpers/stock.helpers';

/** Compra de mercancía: suma stock, recalcula el costo promedio y crea la cuenta por pagar. */
@Injectable()
export class CmEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.CM;

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
      const unitCost = Number(item.unitCost);

      // Costo promedio repartido sobre el stock total ANTES de esta entrada.
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

      // Sin bulto: las compras solo entran al inventario de la bodega, nunca a un
      // bulto; el stock queda sin bulto asignado hasta que un traslado lo mueva.
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

    // Redondeado a pesos enteros: el sistema maneja pesos sin centavos (los montos
    // se muestran y se pagan enteros), así que la cuenta por pagar no debe nacer con
    // un saldo con decimales que "Registrar pago" nunca podría saldar. El total del
    // documento se deja exacto; se acepta una diferencia de hasta ~1 peso.
    await tx.accountsPayable.create({
      data: {
        supplierId: supplier.id,
        documentId: document.id,
        totalAmount: Math.round(Number(document.total)),
        status: 'pending',
      },
    });
  }
}
