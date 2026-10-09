import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, MovementType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import { applyCustomerCredits } from '@/documents/helpers/customer-credit.helpers';
import { BaseEffectStrategy } from './base-effect.strategy';
import type {
  ConfirmContext,
  DocumentWithItems,
} from './document-effect.strategy';

/** Venta de contado: saca stock físico, valorado al precio de venta. No crea cuentas por pagar ni por cobrar. La forma de pago es solo informativa. */
@Injectable()
export class PosEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.POS;

  async validateCreate(createDocumentDto: CreateDocumentDto) {
    await this.validateCashSale(createDocumentDto);
  }

  // Si viene de convertir una preventa, excluye su reserva o da un faltante falso.
  findShortfalls(tx: Prisma.TransactionClient, document: DocumentWithItems) {
    return this.calculateMissingStock(
      tx,
      this.requireWarehouse(document),
      document.documentItems,
      { excludeDocumentId: document.sourceDocumentId ?? undefined },
    );
  }

  async confirm(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    userId: string,
    context?: ConfirmContext,
  ) {
    const warehouseId = this.requireWarehouse(document);

    // Revalida acá porque editar un borrador no re-corre create.
    const shortfalls = await this.findShortfalls(tx, document);

    if (shortfalls.length > 0) {
      throw new ConflictException({
        message: 'Stock insuficiente para uno o más productos',
        shortfalls,
      });
    }

    this.assertPricesAboveFloor(
      document.documentItems.map((item) => ({
        code: item.product.code,
        unitPrice: Number(item.unitPrice),
        minSalePrice: item.product.minSalePrice,
      })),
    );

    for (const item of document.documentItems) {
      await this.moveStock(tx, {
        productId: item.productId,
        warehouseId,
        movementType: MovementType.sale,
        quantity: -item.quantity,
        unitCost: Number(item.product.avgCost),
        documentId: document.id,
        documentItemId: item.id,
        userId,
      });
    }

    // Saldos a favor aplicados a esta venta: descuentan el balance del crédito.
    // El "total a pagar en efectivo" (total − crédito) es informativo del frontend.
    if (context?.appliedCustomerCredits?.length) {
      if (!document.thirdPartyId) {
        throw new ConflictException(
          'La venta requiere un cliente para aplicar saldos a favor',
        );
      }
      await applyCustomerCredits(tx, {
        customerId: document.thirdPartyId,
        saleDocumentId: document.id,
        saleTotal: document.total,
        appliedCustomerCredits: context.appliedCustomerCredits,
      });
    }

    // Venta de contado: no crea cuenta por pagar ni por cobrar.
  }
}
