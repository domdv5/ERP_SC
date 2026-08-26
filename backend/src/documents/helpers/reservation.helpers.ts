import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentStatus, DocumentType } from '@/common/enums';
import type { PrismaService } from '@/prisma/prisma.service';

type PrismaOrTx = PrismaService | Prisma.TransactionClient;

/**
 * Reserva vigente por producto: suma de líneas PV confirmadas
 * (quantity - releasedQuantity - convertedQuantity). No cuenta bodega — la
 * preventa reserva sobre el stock global, igual que computeNewAvgCost.
 * Devuelve 0 (nunca `undefined`) para productIds sin reservas, así los
 * llamadores pueden usar `.get(id)!` sin `?? 0` defensivo.
 */
export async function getReservedByProduct(
  prisma: PrismaOrTx,
  productIds: string[],
  options?: {
    /** Excluye un documento del cómputo — en confirm() de PvEffectStrategy el propio
     * documento ya quedó confirmed antes de validar disponibilidad, así que sin
     * excluirlo restaría su propia reserva contra sí mismo. */
    excludeDocumentId?: string;
  },
): Promise<Map<string, number>> {
  const result = new Map<string, number>(productIds.map((id) => [id, 0]));

  if (productIds.length === 0) {
    return result;
  }

  const grouped = await prisma.documentItem.groupBy({
    by: ['productId'],
    where: {
      productId: { in: productIds },
      document: {
        type: DocumentType.PV,
        status: DocumentStatus.confirmed,
        ...(options?.excludeDocumentId && {
          id: { not: options.excludeDocumentId },
        }),
      },
    },
    _sum: { quantity: true, releasedQuantity: true, convertedQuantity: true },
  });

  for (const row of grouped) {
    const reserved =
      (row._sum.quantity ?? 0) -
      (row._sum.releasedQuantity ?? 0) -
      (row._sum.convertedQuantity ?? 0);
    result.set(row.productId, reserved);
  }

  return result;
}

/** Números crudos que un llamador de assertAvailableForReservation recibe para redactar su propio mensaje de error. */
export interface AvailabilityShortfall {
  available: number;
  reserved: number;
  requestedQty: number;
}

/**
 * Valida disponibilidad de un producto (stock menos reserva) antes de reservarlo
 * o restarle stock (void de compra/EAI, salida SAJ/DVC/T). `buildMessage` deja
 * que cada llamador redacte su mensaje con los números reales. Bloquea
 * `Inventory` con `FOR UPDATE` antes de leer — sin esto, transacciones
 * concurrentes leerían el mismo "disponible" y podrían sobre-reservar. Por eso
 * exige `Prisma.TransactionClient` real: fuera de una transacción el lock no protege.
 */
export async function assertAvailableForReservation(
  tx: Prisma.TransactionClient,
  productId: string,
  warehouseId: string,
  requestedQty: number,
  buildMessage?: (shortfall: AvailabilityShortfall) => string,
): Promise<void> {
  const rows = await tx.$queryRaw<{ quantity: number }[]>`
    SELECT quantity FROM inventory
    WHERE product_id = ${productId}::uuid AND warehouse_id = ${warehouseId}::uuid
    FOR UPDATE
  `;

  const totalStock = rows[0]?.quantity ?? 0;
  const reserved =
    (await getReservedByProduct(tx, [productId])).get(productId) ?? 0;
  const available = totalStock - reserved;

  if (available < requestedQty) {
    const message = buildMessage
      ? buildMessage({ available, reserved, requestedQty })
      : `No hay stock suficiente para reservar: quedan ${available} unidades disponibles, se necesitan ${requestedQty}.`;
    throw new ConflictException(message);
  }
}
