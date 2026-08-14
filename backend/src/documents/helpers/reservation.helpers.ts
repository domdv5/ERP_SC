import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentStatus, DocumentType } from '@/common/enums';
import type { PrismaService } from '@/prisma/prisma.service';

type PrismaOrTx = PrismaService | Prisma.TransactionClient;

/**
 * Reserva vigente por producto: suma de líneas de PV confirmados
 * (quantity - releasedQuantity - convertedQuantity). Nunca cuenta bodega —
 * la preventa reserva sobre el stock global del producto, igual que
 * computeNewAvgCost pondera sobre stock global.
 *
 * Devuelve un Map con una entrada en 0 para cada productId solicitado que no
 * tenga reservas — nunca `undefined`, para que los llamadores puedan hacer
 * `.get(id)!` sin un `?? 0` defensivo en cada sitio.
 */
export async function getReservedByProduct(
  prisma: PrismaOrTx,
  productIds: string[],
  options?: {
    /** Excluye un documento puntual del cómputo — ver confirm() de PvEffectStrategy:
     * el propio documento ya quedó en status confirmed (misma tx, updateMany previo
     * en documents.service.ts) antes de que la estrategia valide disponibilidad, así
     * que sin excluirlo se restaría su propia reserva contra sí mismo. */
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
 * Valida disponibilidad de un solo producto (stock de bodega menos reserva
 * vigente) antes de comprometerlo en una reserva, o antes de restarle stock
 * a la bodega por cualquier otro motivo (ej. anular una compra/EAI — ver
 * documents.service.ts::void(), o sacar stock por SAJ/DVC/T — ver
 * assertSufficientStock en stock.helpers.ts). `buildMessage` deja que cada
 * llamador redacte su propio mensaje con los números reales — un solo texto
 * genérico no se leía natural tanto para "confirmar" como para "anular".
 *
 * Bloquea la fila de `Inventory` con `FOR UPDATE` (mismo patrón que
 * accounts-payable.service.ts::registerPayment) antes de leer la cantidad:
 * sin esto, dos transacciones concurrentes sobre el mismo producto/bodega
 * (dos SAJ, o un SAJ contra una PV confirmándose al mismo tiempo) podrían
 * leer el mismo "disponible" antes de que ninguna escriba, pasar el chequeo
 * las dos, y terminar sobre-reservando o sobre-restando sin que
 * `Inventory.quantity` llegue a ir en negativo (por eso `applyStockChange`
 * no detecta este caso por su cuenta). Requiere correr dentro de una
 * transacción real — por eso el tipo es `Prisma.TransactionClient`, no
 * `PrismaOrTx`: fuera de una transacción el `FOR UPDATE` se libera apenas
 * termina la sentencia y no protege nada.
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
