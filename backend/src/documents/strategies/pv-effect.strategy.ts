import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentType } from '@/common/enums';
import { CreateDocumentDto } from '@/documents/dto/index';
import { BaseEffectStrategy } from './base-effect.strategy';
import type {
  DocumentWithItems,
  ReservationEffectStrategy,
} from './document-effect.strategy';

/**
 * PV — Preventa: reserva lógica de inventario, sin movimiento físico.
 * confirm() NUNCA llama a moveStock/applyStockChange/applyBinStockChange —
 * la reserva se materializa por el solo hecho de que el Document queda en
 * status confirmed; getReservedByProduct la deriva sumando líneas de PV
 * confirmados, no hay ninguna tabla de "stock reservado" separada.
 */
@Injectable()
export class PvEffectStrategy
  extends BaseEffectStrategy
  implements ReservationEffectStrategy
{
  readonly type = DocumentType.PV;

  async validateCreate(createDocumentDto: CreateDocumentDto) {
    const { thirdPartyId, sellerId } = createDocumentDto;

    const thirdParty = thirdPartyId
      ? await this.prisma.thirdParty.findUnique({
          where: { id: thirdPartyId },
          include: { customer: true },
        })
      : null;

    if (!thirdParty?.customer) {
      throw new BadRequestException('La preventa requiere un cliente válido');
    }

    if (!sellerId) {
      throw new BadRequestException('La preventa requiere un vendedor');
    }

    const seller = await this.prisma.thirdParty.findUnique({
      where: { id: sellerId },
    });

    if (!seller?.isSeller) {
      throw new BadRequestException('El vendedor asignado no es válido');
    }
  }

  async confirm(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    _userId: string,
  ) {
    const warehouseId = this.requireWarehouse(document);

    // assertBatchAvailability (BaseEffectStrategy) concentra el batch +
    // FOR UPDATE que antes vivía acá inline — ver su doc comment para el
    // razonamiento del lock. PV corta en el primer faltante para mantener
    // su mensaje histórico de error (comportamiento sin cambios).
    const shortfalls = await this.assertBatchAvailability(
      tx,
      warehouseId,
      document.documentItems,
      { excludeDocumentId: document.id },
    );

    if (shortfalls.length > 0) {
      const s = shortfalls[0];
      throw new ConflictException(
        `Stock insuficiente para reservar el producto ${s.code}: disponible ${s.available}, solicitado ${s.requested}`,
      );
    }

    // Sin moveStock: la preventa no toca Inventory/BinStock/InventoryMovement.
  }

  async releaseItems(
    tx: Prisma.TransactionClient,
    document: DocumentWithItems,
    releases: { documentItemId: string; quantity: number }[],
    userId: string,
    notes?: string,
  ) {
    for (const release of releases) {
      const item = await tx.documentItem.findUnique({
        where: { id: release.documentItemId },
        include: { product: { select: { code: true } } },
      });

      if (!item || item.documentId !== document.id) {
        throw new BadRequestException(
          'El ítem indicado no pertenece a este documento',
        );
      }

      if (release.quantity <= 0) {
        throw new BadRequestException(
          'La cantidad a liberar debe ser mayor a cero',
        );
      }

      const pending =
        item.quantity - item.releasedQuantity - item.convertedQuantity;

      if (release.quantity > pending) {
        throw new ConflictException(
          `No se puede liberar ${release.quantity} del producto ${item.product.code}: la reserva pendiente es ${pending}`,
        );
      }

      // Update atómico (mismo patrón que applyStockChange en stock.helpers.ts):
      // el WHERE re-valida la disponibilidad en la misma sentencia que escribe,
      // así dos liberaciones concurrentes del mismo ítem no pueden pisarse.
      const rows = await tx.$queryRaw<{ released_quantity: number }[]>`
        UPDATE document_item
        SET released_quantity = released_quantity + ${release.quantity}
        WHERE id = ${release.documentItemId}::uuid
          AND released_quantity + converted_quantity + ${release.quantity} <= quantity
        RETURNING released_quantity
      `;

      if (rows.length === 0) {
        throw new ConflictException(
          `No se pudo liberar la reserva del producto ${item.product.code} (posible actualización concurrente)`,
        );
      }

      await tx.reservationRelease.create({
        data: {
          documentItemId: release.documentItemId,
          quantity: release.quantity,
          userId,
          notes: notes ?? null,
        },
      });
    }
  }

  async consumeForConversion(
    tx: Prisma.TransactionClient,
    sourceDocument: DocumentWithItems,
    conversions: { documentItemId: string; quantity: number }[],
    _userId: string,
  ) {
    for (const conversion of conversions) {
      const item = sourceDocument.documentItems.find(
        (i) => i.id === conversion.documentItemId,
      );

      if (!item || conversion.quantity <= 0) {
        continue;
      }

      // Mismo patrón atómico UPDATE...WHERE...RETURNING que releaseItems —
      // el audit trail de esta operación es el propio documento derivado
      // (sourceDocumentId), no ReservationRelease (esa tabla es solo para
      // liberaciones manuales).
      const rows = await tx.$queryRaw<{ converted_quantity: number }[]>`
        UPDATE document_item
        SET converted_quantity = converted_quantity + ${conversion.quantity}
        WHERE id = ${conversion.documentItemId}::uuid
          AND released_quantity + converted_quantity + ${conversion.quantity} <= quantity
        RETURNING converted_quantity
      `;

      if (rows.length === 0) {
        throw new ConflictException(
          `No se pudo consumir la reserva del producto ${item.product.code} (posible actualización concurrente)`,
        );
      }
    }
  }
}
