import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentStatus, MovementType } from '@/common/enums';
import type { DocumentWithItems } from '@/documents/strategies/document-effect.strategy';
import { assertAvailableForReservation } from './reservation.helpers';

/** Suma `delta` al inventario en una sola sentencia (sin leer y luego escribir): la propia sentencia bloquea la fila, evitando que dos confirmaciones a la vez se pisen. */
export async function applyStockChange(
  tx: Prisma.TransactionClient,
  params: {
    productId: string;
    warehouseId: string;
    delta: number;
  },
) {
  const { productId, warehouseId, delta } = params;

  if (delta >= 0) {
    // Si la fila no existía todavía, se crea (seguro aunque sea el primer stock).
    const rows = await tx.$queryRaw<{ quantity: number }[]>`
      INSERT INTO inventory (product_id, warehouse_id, quantity)
      VALUES (${productId}::uuid, ${warehouseId}::uuid, ${delta})
      ON CONFLICT (product_id, warehouse_id)
      DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity
      RETURNING quantity
    `;
    const newStock = rows[0].quantity;
    return { previousStock: newStock - delta, newStock };
  }

  // Solo actualiza, no crea: descontar de una fila que no existe no tiene sentido.
  // La misma sentencia que escribe valida que haya stock suficiente.
  const rows = await tx.$queryRaw<{ quantity: number }[]>`
    UPDATE inventory SET quantity = quantity + ${delta}
    WHERE product_id = ${productId}::uuid AND warehouse_id = ${warehouseId}::uuid
      AND quantity + ${delta} >= 0
    RETURNING quantity
  `;

  if (rows.length === 0) {
    throw new ConflictException(
      'Stock insuficiente para completar la operación (posible actualización concurrente)',
    );
  }

  const newStock = rows[0].quantity;
  return { previousStock: newStock - delta, newStock };
}

/** Aplica el delta al stock del bulto de forma atómica (igual que el cambio de stock de bodega). No devuelve el stock antes/después porque sus llamadores no lo usan. */
export async function applyBinStockChange(
  tx: Prisma.TransactionClient,
  params: {
    productId: string;
    binId: string;
    warehouseId: string;
    delta: number;
  },
) {
  const { productId, binId, warehouseId, delta } = params;

  if (delta >= 0) {
    await tx.$executeRaw`
      INSERT INTO bin_stock (product_id, bin_id, warehouse_id, quantity)
      VALUES (${productId}::uuid, ${binId}::uuid, ${warehouseId}::uuid, ${delta})
      ON CONFLICT (product_id, bin_id)
      DO UPDATE SET quantity = bin_stock.quantity + EXCLUDED.quantity
    `;
    return;
  }

  const rowsAffected = await tx.$executeRaw`
    UPDATE bin_stock SET quantity = quantity + ${delta}
    WHERE product_id = ${productId}::uuid AND bin_id = ${binId}::uuid
      AND quantity + ${delta} >= 0
  `;

  if (rowsAffected === 0) {
    throw new ConflictException(
      'Stock insuficiente en el bulto para completar la operación (posible actualización concurrente)',
    );
  }
}

/**
 * Valida stock suficiente para la salida. En bodegas `store` delega en
 * la validación de disponibilidad (descuenta las reservas de preventa y bloquea
 * la fila); si no, una salida, devolución o traslado podría sacar stock ya
 * comprometido con una preventa. En las bodegas físicas no aplica: las preventas
 * no reservan ahí, así que compara el stock crudo.
 */
export async function assertSufficientStock(
  tx: Prisma.TransactionClient,
  item: DocumentWithItems['documentItems'][number],
  warehouseId: string,
  quantity: number,
) {
  const warehouse = await tx.warehouse.findUniqueOrThrow({
    where: { id: warehouseId },
    select: { type: true },
  });

  if (warehouse.type === 'store') {
    await assertAvailableForReservation(
      tx,
      item.productId,
      warehouseId,
      quantity,
      ({ available, reserved, requestedQty }) => {
        const reservedNote =
          reserved > 0 ? ` (${reserved} ya reservadas por preventas)` : '';
        return `No hay stock suficiente de ${item.product.code} para esta operación: quedan ${available} unidades disponibles${reservedNote}, pero se necesitan ${requestedQty}.`;
      },
    );
    return;
  }

  const inventory = await tx.inventory.findUnique({
    where: {
      productId_warehouseId: { productId: item.productId, warehouseId },
    },
  });

  if ((inventory?.quantity ?? 0) < quantity) {
    throw new ConflictException(
      `Stock insuficiente para el producto ${item.product.code} en la bodega: disponible ${inventory?.quantity ?? 0}, solicitado ${quantity}`,
    );
  }
}

/** Verifica que el bulto de origen tenga stock suficiente del producto para la salida. */
export async function assertSufficientBinStock(
  tx: Prisma.TransactionClient,
  item: DocumentWithItems['documentItems'][number],
  binId: string,
  quantity: number,
) {
  const binStock = await tx.binStock.findUnique({
    where: {
      productId_binId: { productId: item.productId, binId },
    },
  });

  if ((binStock?.quantity ?? 0) < quantity) {
    throw new ConflictException(
      `Stock insuficiente para el producto ${item.product.code} en el bulto de origen`,
    );
  }
}

/** Stock total del producto sumando todas las bodegas. Lo usan el recálculo del
 * costo promedio y su reversa, que reparten sobre este mismo total. */
async function getGlobalStock(tx: Prisma.TransactionClient, productId: string) {
  const aggregate = await tx.inventory.aggregate({
    _sum: { quantity: true },
    where: { productId },
  });
  return aggregate._sum.quantity ?? 0;
}

/** Recalcula el costo promedio repartiéndolo sobre el stock total ANTES de la entrada. */
export async function computeNewAvgCost(
  tx: Prisma.TransactionClient,
  productId: string,
  currentAvgCost: number,
  quantity: number,
  unitCost: number,
) {
  const globalStock = await getGlobalStock(tx, productId);
  const denominator = globalStock + quantity;

  if (denominator <= 0) return unitCost;

  return (globalStock * currentAvgCost + quantity * unitCost) / denominator;
}

/**
 * Deshace un recálculo del costo promedio (la operación inversa). Solo da el valor
 * exacto si no hubo consumo de stock entre la compra original y esta reversa; por
 * eso quien la llama (la anulación de documentos) debe verificar antes que ese
 * movimiento sea el más reciente del producto.
 */
export async function computeReversedAvgCost(
  tx: Prisma.TransactionClient,
  productId: string,
  currentAvgCost: number,
  quantity: number,
  unitCost: number,
) {
  const globalStock = await getGlobalStock(tx, productId);
  const denominator = globalStock - quantity;

  if (denominator <= 0) return currentAvgCost;

  return (globalStock * currentAvgCost - quantity * unitCost) / denominator;
}

/**
 * Calcula el nuevo "último costo" del producto tras anular una compra (`undefined`
 * si no hay que tocarlo). Solo las compras escriben el último costo, así que la
 * búsqueda nunca mira ajustes de inventario. Si ya hay una compra viva más reciente,
 * no se toca; si no, busca la compra viva inmediatamente anterior (o 0 si no hay).
 */
export async function resolveLastCostAfterVoidingCm(
  tx: Prisma.TransactionClient,
  productId: string,
  voidedDocumentId: string,
  voidedMovementCreatedAt: Date,
): Promise<number | undefined> {
  const laterPurchase = await tx.inventoryMovement.findFirst({
    where: {
      productId,
      documentId: { not: voidedDocumentId },
      movementType: MovementType.purchase,
      createdAt: { gt: voidedMovementCreatedAt },
      document: { status: { not: DocumentStatus.voided } },
    },
  });

  if (laterPurchase) return undefined;

  const previousPurchase = await tx.inventoryMovement.findFirst({
    where: {
      productId,
      documentId: { not: voidedDocumentId },
      movementType: MovementType.purchase,
      createdAt: { lt: voidedMovementCreatedAt },
      document: { status: { not: DocumentStatus.voided } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return previousPurchase ? Number(previousPurchase.unitCost) : 0;
}
