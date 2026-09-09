import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentStatus, DocumentType } from '@/common/enums';
import type { PrismaService } from '@/prisma/prisma.service';

type PrismaOrTx = PrismaService | Prisma.TransactionClient;

/** Tipos que reservan stock de forma lógica: quedan confirmados pero no mueven inventario físico. */
export const RESERVATION_TYPES: DocumentType[] = [
  DocumentType.PV,
  DocumentType.REM,
];

/**
 * Cuánto hay reservado hoy por producto: suma de las líneas de preventas y
 * remisiones confirmadas, restando lo ya liberado y lo ya convertido en venta.
 * No distingue bodega: la reserva es sobre el stock total. Devuelve 0 (nunca
 * indefinido) para los productos sin reservas.
 */
export async function getReservedByProduct(
  prisma: PrismaOrTx,
  productIds: string[],
  options?: {
    excludeDocumentId?: string;
    types?: DocumentType[];
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
        type: { in: options?.types ?? RESERVATION_TYPES },
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

/** Cifras en bruto que recibe quien valida disponibilidad para armar su propio mensaje de error. */
export interface AvailabilityShortfall {
  available: number;
  reserved: number;
  requestedQty: number;
}

/**
 * Verifica que un producto tenga disponible (stock menos reservas) antes de
 * reservarlo o de quitarle stock (anular una compra o ajuste, una salida o un
 * traslado). Cada llamador arma su mensaje con `buildMessage`. Bloquea la fila
 * de inventario antes de leerla: sin ese bloqueo, dos operaciones a la vez
 * leerían el mismo disponible y podrían reservar de más. Por eso exige correr
 * dentro de una transacción.
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
