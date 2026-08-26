import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentStatus, MovementType } from '@/common/enums';
import type { DocumentWithItems } from '@/documents/strategies/document-effect.strategy';
import { assertAvailableForReservation } from './reservation.helpers';

/** Suma `delta` a Inventory en un solo UPDATE/ON CONFLICT (no read-then-write): el propio statement bloquea la fila, evitando que dos confirmaciones concurrentes se pisen. */
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
    // ON CONFLICT crea la fila si no existía todavía (seguro aunque sea el primer stock).
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

  // UPDATE simple, no INSERT: un decremento sobre una fila inexistente no tiene
  // sentido. El WHERE valida suficiencia en la misma sentencia que escribe.
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

/** Aplica el delta a BinStock de forma atómica (mismo patrón que applyStockChange). No devuelve previousStock/newStock — sus llamadores descartan el retorno. */
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
 * assertAvailableForReservation (descuenta reservas de PV, bloquea la fila) —
 * si no, SAJ/DVC/T podrían sacar stock ya comprometido con una preventa. En
 * bodegas `warehouse` no aplica: las preventas no reservan ahí, compara stock crudo.
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

/** Valida que haya stock suficiente del producto en el bulto de origen para la salida. */
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

/** Stock global del producto (sumado entre todas las bodegas). Compartido por
 * computeNewAvgCost/computeReversedAvgCost, que re-ponderan sobre este mismo total. */
async function getGlobalStock(tx: Prisma.TransactionClient, productId: string) {
  const aggregate = await tx.inventory.aggregate({
    _sum: { quantity: true },
    where: { productId },
  });
  return aggregate._sum.quantity ?? 0;
}

/** Re-pondera el avgCost sobre el stock global ANTES de la entrada. */
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
 * Reversa una re-ponderación de avgCost (inversa de computeNewAvgCost). Solo es
 * exacta si no hubo consumo de stock entre la compra original y esta reversión —
 * por eso el llamador (documents.service.ts::void()) debe garantizar esa ausencia
 * (chequeo de recencia) antes de invocarla.
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
 * Determina el nuevo Product.lastCost tras anular un CM (`undefined` si no debe
 * tocarse). Solo CM escribe lastCost, así que el fallback nunca mira movimientos
 * `adjustment`. Si ya existe una compra CM viva más reciente, no se toca; si no,
 * busca la compra CM viva inmediatamente anterior (o 0 si no hay ninguna).
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
