import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, MovementType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import { BaseEffectStrategy } from './base-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';

/**
 * POS — Venta de contado: salida física de inventario, valorada a unitPrice
 * (ver PRICE_BASED_TYPES en documents.service.ts). No genera AccountsPayable
 * ni AccountsReceivable (venta de contado). paymentMethod es puramente
 * informativo — no hay CashModule todavía, así que no dispara ninguna
 * lógica de caja/conciliación.
 */
@Injectable()
export class PosEffectStrategy extends BaseEffectStrategy {
  readonly type = DocumentType.POS;

  async validateCreate(createDocumentDto: CreateDocumentDto) {
    const { thirdPartyId, sellerId, paymentMethod, items } =
      createDocumentDto;

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

    if (!paymentMethod) {
      throw new BadRequestException('La venta requiere una forma de pago');
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
  }

  async confirm(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    userId: string,
  ) {
    const warehouseId = this.requireWarehouse(document);

    // Re-chequeo: un PATCH sobre un borrador no vuelve a correr
    // validateCreate() (mismo motivo ya documentado para EAI/T en
    // base-effect.strategy.ts). Si este POS viene de convertir una PV
    // (sourceDocumentId), esa PV todavía figura como reserva activa en este
    // punto — consumeForConversion recién la descuenta después de que
    // confirm() termina (ver documents.service.ts::confirm()) — así que hay
    // que excluirla del cómputo de disponibilidad, igual que
    // PvEffectStrategy.confirm() se excluye a sí misma. Sin esto, convertir
    // una PV que reservó el 100% del stock disponible (el caso típico de una
    // conversión total) siempre fallaba con un shortfall falso, porque la
    // propia reserva de origen competía contra la venta que la reemplaza.
    const shortfalls = await this.assertBatchAvailability(
      tx,
      warehouseId,
      document.documentItems,
      { excludeDocumentId: document.sourceDocumentId ?? undefined },
    );

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

    // Venta de contado: no crea AccountsPayable ni AccountsReceivable.
  }
}
