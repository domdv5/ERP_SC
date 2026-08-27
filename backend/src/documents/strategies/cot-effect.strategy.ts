import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType, MovementType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import { assertCreditWithinLimit } from '@/documents/helpers/credit.helpers';
import { BaseEffectStrategy } from './base-effect.strategy';
import type { DocumentWithItems } from './document-effect.strategy';

/** COT — venta a crédito: igual que POS (salida física de stock valorada a unitPrice, PRICE_BASED_TYPES) pero no exige forma de pago, valida el cupo de crédito del cliente, y al confirmar genera una AccountsReceivable. */
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

    // Cupo de crédito: bloqueo duro si el total (valorado a unitPrice) supera
    // el disponible del cliente.
    const requestedTotal = items.reduce(
      (sum, item) => sum + item.quantity * (item.unitPrice ?? 0),
      0,
    );
    await assertCreditWithinLimit(this.prisma, thirdParty.id, requestedTotal);
  }

  async confirm(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    userId: string,
  ) {
    const warehouseId = this.requireWarehouse(document);

    // Re-chequeo (PATCH no vuelve a correr validateCreate). Si viene de convertir
    // una PV, su reserva sigue activa aquí — hay que excluirla o daría un
    // shortfall falso contra sí misma (mismo motivo que POS).
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

    if (!document.thirdPartyId) {
      throw new BadRequestException('La venta requiere un cliente válido');
    }
    if (!document.sellerId) {
      throw new BadRequestException('La venta requiere un vendedor');
    }

    // Bloquea la fila del cliente hasta el fin de la tx: dos COT concurrentes del
    // mismo cliente no pueden superar el cupo en conjunto (mismo patrón FOR UPDATE
    // que registerPayment). El re-chequeo cubre además el PATCH-bypass: update()
    // no re-corre validateCreate, así que se valida con el total definitivo.
    await tx.$queryRaw`SELECT id FROM customers WHERE id = ${document.thirdPartyId}::uuid FOR UPDATE`;
    await assertCreditWithinLimit(
      tx,
      document.thirdPartyId,
      Number(document.total),
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

    // Venta a crédito: genera la cuenta por cobrar del cliente.
    // Customer.id === ThirdParty.id (schema:114). dueDate se omite → null (v1).
    // totalAmount redondeado a pesos enteros: el sistema trata COP sin centavos
    // (formatCOP, input de pago entero) — la CxC no debe nacer con saldo
    // fraccionario que el "Registrar pago" no pueda saldar. document.total se
    // deja exacto; se acepta un delta de hasta ~1 peso.
    await tx.accountsReceivable.create({
      data: {
        clientId: document.thirdPartyId,
        sellerId: document.sellerId,
        documentId: document.id,
        totalAmount: Math.round(Number(document.total)),
        status: 'pending',
      },
    });
  }
}
