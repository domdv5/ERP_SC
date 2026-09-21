import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateDocumentDto } from '@/documents/dto/index';
import { BaseEffectStrategy } from './base-effect.strategy';
import type {
  ConfirmContext,
  DocumentWithItems,
  ReservationEffectStrategy,
} from './document-effect.strategy';

/** Base común de PV/REM: reservan stock sin mover inventario físico; la reserva es el documento confirmado, no hay tabla aparte. */
@Injectable()
export abstract class AbstractReservationStrategy
  extends BaseEffectStrategy
  implements ReservationEffectStrategy
{
  /** Sustantivo con artículo para los mensajes: "la preventa" o "la remisión". */
  protected abstract readonly entityNoun: string;

  async validateCreate(createDocumentDto: CreateDocumentDto) {
    const { thirdPartyId, sellerId } = createDocumentDto;
    const noun =
      this.entityNoun.charAt(0).toUpperCase() + this.entityNoun.slice(1);

    const thirdParty = thirdPartyId
      ? await this.prisma.thirdParty.findUnique({
          where: { id: thirdPartyId },
          include: { customer: true },
        })
      : null;

    if (!thirdParty?.customer) {
      throw new BadRequestException(`${noun} requiere un cliente válido`);
    }

    if (!sellerId) {
      throw new BadRequestException(`${noun} requiere un vendedor`);
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
    _context?: ConfirmContext,
  ) {
    const warehouseId = this.requireWarehouse(document);

    // Bloquea las filas de inventario al validar: dos confirmaciones del mismo producto a la vez quedan en fila.
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

    // No se mueve stock: la reserva no toca el inventario físico.
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

      // Actualización atómica: la misma sentencia vuelve a validar la cantidad
      // pendiente, así dos liberaciones a la vez no se pisan.
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

      // Misma actualización atómica que al liberar. Acá el rastro queda en la
      // venta derivada, no en el registro de liberaciones (ese es solo para las manuales).
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
