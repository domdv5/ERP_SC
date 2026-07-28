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

/**
 * Valida disponibilidad de un solo producto (stock de bodega menos reserva
 * vigente) antes de comprometerlo en una reserva. No la usa PvEffectStrategy
 * .confirm() (esa hace la misma cuenta en batch para evitar N+1 al validar
 * todos los ítems del documento) — queda disponible para futuros llamadores
 * de un solo producto (ej. un endpoint de "verificar disponibilidad" en UI).
 */
export async function assertAvailableForReservation(
  prisma: PrismaOrTx,
  productId: string,
  warehouseId: string,
  requestedQty: number,
): Promise<void> {
  const [inventory, reservedMap] = await Promise.all([
    prisma.inventory.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    }),
    getReservedByProduct(prisma, [productId]),
  ]);

  const totalStock = inventory?.quantity ?? 0;
  const reserved = reservedMap.get(productId) ?? 0;
  const available = totalStock - reserved;

  if (available < requestedQty) {
    throw new ConflictException(
      `Stock insuficiente para reservar: disponible ${available}, solicitado ${requestedQty}`,
    );
  }
}
