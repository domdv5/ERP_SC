import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, MovementType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import { applyCustomerCredits } from '@/documents/helpers/customer-credit.helpers';
import { assertCreditWithinLimit } from '@/documents/helpers/credit.helpers';
import {
  assertCreditIsPartial,
  assertPaymentsMatchTotal,
  getCreditPaymentAmount,
} from '@/documents/helpers/payment.helpers';
import { BaseEffectStrategy } from './base-effect.strategy';
import type {
  ConfirmContext,
  DocumentWithItems,
} from './document-effect.strategy';

/** Venta de contado: saca stock físico, valorado al precio de venta. Exige que las formas de pago (crédito incluido) sumen el total menos los saldos a favor aplicados; la línea `credito` genera una CxC por su monto. */
@Injectable()
export class PosEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.POS;
  readonly tracksCustomerBranch = true;
  readonly usesTodayDate = true;
  protected readonly tracksItemAddedAt = true;

  async validateCreate(createDocumentDto: CreateDocumentDto) {
    await this.validateCashSale(createDocumentDto);
    await this.assertValidCustomerBranch(
      createDocumentDto.thirdPartyId,
      createDocumentDto.customerBranchId,
    );

    const creditAmount = getCreditPaymentAmount(
      createDocumentDto.payments ?? [],
    );
    if (creditAmount.gt(0) && createDocumentDto.thirdPartyId) {
      await assertCreditWithinLimit(
        this.prisma,
        createDocumentDto.thirdPartyId,
        creditAmount.toNumber(),
      );
    }
  }

  // Si viene de convertir una preventa, excluye su reserva o da un faltante falso.
  findMissingStock(tx: Prisma.TransactionClient, document: DocumentWithItems) {
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

    const appliedCredits = (context?.appliedCustomerCredits ?? []).reduce(
      (sum, credit) => sum.plus(credit.amount),
      new Prisma.Decimal(0),
    );
    const amountToCollect = new Prisma.Decimal(document.total).minus(
      appliedCredits,
    );
    assertPaymentsMatchTotal(document.payments, amountToCollect);

    const creditAmount = getCreditPaymentAmount(document.payments);
    assertCreditIsPartial(creditAmount, amountToCollect);

    if (creditAmount.gt(0)) {
      if (!document.thirdPartyId || !document.sellerId) {
        throw new ConflictException(
          'La venta con crédito requiere cliente y vendedor',
        );
      }
      // Mismo bloqueo que COT: dos ventas a crédito del mismo cliente no superan el cupo entre las dos.
      await tx.$queryRaw`SELECT id FROM customers WHERE id = ${document.thirdPartyId}::uuid FOR UPDATE`;
      await assertCreditWithinLimit(
        tx,
        document.thirdPartyId,
        creditAmount.toNumber(),
      );
    }

    await this.assertValidCustomerBranch(
      document.thirdPartyId,
      document.customerBranchId,
    );

    // Revalida acá porque editar un borrador no re-corre create.
    const missingStock = await this.findMissingStock(tx, document);

    if (missingStock.length > 0) {
      throw new ConflictException({
        message: 'Stock insuficiente para uno o más productos',
        missingStock,
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

    if (creditAmount.gt(0)) {
      await tx.accountsReceivable.create({
        data: {
          clientId: document.thirdPartyId!,
          sellerId: document.sellerId!,
          documentId: document.id,
          totalAmount: creditAmount,
          status: 'pending',
        },
      });
    }

    // Saldos a favor aplicados a esta venta: descuentan el balance del crédito.
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
  }
}
