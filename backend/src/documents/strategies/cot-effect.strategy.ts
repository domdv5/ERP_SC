import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, MovementType } from '@/common/enums';
import { toCents } from '@/common/utils/money.util';
import { CreateDocumentDto } from '@/documents/dto/index';
import { assertCreditWithinLimit } from '@/documents/helpers/credit.helpers';
import { applyCustomerCredits } from '@/documents/helpers/customer-credit.helpers';
import { BaseEffectStrategy } from './base-effect.strategy';
import type {
  ConfirmContext,
  DocumentWithItems,
} from './document-effect.strategy';

/** Venta a crédito: igual que la venta de contado (saca stock físico, valorado al precio de venta) pero no pide forma de pago, valida el cupo de crédito del cliente y al confirmar crea una cuenta por cobrar. */
@Injectable()
export class CotEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.COT;

  async validateCreate(createDocumentDto: CreateDocumentDto) {
    const { thirdPartyId, sellerId, items } = createDocumentDto;

    const thirdParty = thirdPartyId
      ? await this.prisma.thirdParty.findUnique({
          where: { id: thirdPartyId },
          include: { customer: true },
        })
      : null;

    if (!thirdParty?.customer) {
      throw new BadRequestException('La venta requiere un cliente válido');
    }

    if (!sellerId) {
      throw new BadRequestException('La venta requiere un vendedor');
    }

    const seller = await this.prisma.thirdParty.findUnique({
      where: { id: sellerId },
    });

    if (!seller?.isSeller) {
      throw new BadRequestException('El vendedor asignado no es válido');
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      select: { id: true, code: true, minSalePrice: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    this.assertPricesAboveFloor(
      items.map((item) => {
        const product = productById.get(item.productId);
        return {
          code: product?.code ?? item.productId,
          unitPrice: item.unitPrice ?? 0,
          minSalePrice: product?.minSalePrice ?? 0,
        };
      }),
    );

    // Cupo de crédito se valida sobre el neto (total menos saldos a favor a aplicar), no sobre el bruto.
    const grossTotal = items.reduce(
      (sum, item) => sum + item.quantity * (item.unitPrice ?? 0),
      0,
    );
    const creditsTotal = (createDocumentDto.customerCredits ?? []).reduce(
      (sum, credit) => sum + credit.amount,
      0,
    );
    const netTotal = Math.max(0, grossTotal - creditsTotal);
    await assertCreditWithinLimit(this.prisma, thirdParty.id, netTotal);
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

    if (!document.thirdPartyId) {
      throw new BadRequestException('La venta requiere un cliente válido');
    }
    if (!document.sellerId) {
      throw new BadRequestException('La venta requiere un vendedor');
    }

    // La cuenta por cobrar nace neta de los saldos a favor aplicados; el cupo también se valida sobre ese neto.
    const appliedCents = (context?.appliedCustomerCredits ?? []).reduce(
      (sum, credit) => sum + toCents(credit.amount),
      0,
    );
    const totalCents = toCents(Number(document.total));

    // Rechaza la sobre-aplicación ANTES de crear la cuenta por cobrar: netCents negativo
    // violaría el CHECK accounts_receivable_paid_amount_range_chk (paid_amount <= total_amount)
    // con un error crudo de Postgres en vez de este 400 — applyCustomerCredits() repite este
    // mismo chequeo más abajo, pero para entonces la cuenta ya se habría intentado crear.
    if (appliedCents > totalCents) {
      throw new BadRequestException(
        'El saldo a favor aplicado no puede superar el total de la venta',
      );
    }

    const netCents = totalCents - appliedCents;

    // Bloquea al cliente hasta el fin de la tx: dos ventas a crédito concurrentes no pueden superar el cupo entre las dos (orden global: customers -> customer_credit -> accounts_receivable).
    await tx.$queryRaw`SELECT id FROM customers WHERE id = ${document.thirdPartyId}::uuid FOR UPDATE`;
    await assertCreditWithinLimit(
      tx,
      document.thirdPartyId,
      Math.max(0, netCents) / 100,
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

    // Cuenta por cobrar neta de los saldos a favor aplicados, redondeada a pesos enteros; si el saldo cubre todo, nace saldada.
    await tx.accountsReceivable.create({
      data: {
        clientId: document.thirdPartyId,
        sellerId: document.sellerId,
        documentId: document.id,
        totalAmount: Math.round(netCents / 100),
        status: netCents === 0 ? 'paid' : 'pending',
      },
    });

    // Descuenta el balance de cada saldo a favor citado. Techo = total bruto de
    // la venta (no el neto): la suma aplicada nunca puede superar lo que se vende.
    if (context?.appliedCustomerCredits?.length) {
      await applyCustomerCredits(tx, {
        customerId: document.thirdPartyId,
        saleDocumentId: document.id,
        saleTotal: document.total,
        appliedCustomerCredits: context.appliedCustomerCredits,
      });
    }
  }
}
