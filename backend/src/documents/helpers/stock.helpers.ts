import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DocumentWithItems } from '@/documents/strategies/document-effect.strategy';

/** Lee el stock actual del par (producto, bodega), aplica el delta y upserta Inventory. */
export async function applyStockChange(
  tx: Prisma.TransactionClient,
  params: {
    productId: string;
    warehouseId: string;
    delta: number;
    binId?: string | null;
  },
) {
  const { productId, warehouseId, delta, binId } = params;

  const inventory = await tx.inventory.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });

  const previousStock = inventory?.quantity ?? 0;
  const newStock = previousStock + delta;

  await tx.inventory.upsert({
    where: { productId_warehouseId: { productId, warehouseId } },
    create: { productId, warehouseId, quantity: newStock, binId },
    update: { quantity: newStock, ...(binId != null && { binId }) },
  });

  return { previousStock, newStock };
}

/** Valida que haya stock suficiente del producto en la bodega para la salida. */
export async function assertSufficientStock(
  tx: Prisma.TransactionClient,
  item: DocumentWithItems['documentItems'][number],
  warehouseId: string,
  quantity: number,
) {
  const inventory = await tx.inventory.findUnique({
    where: {
      productId_warehouseId: { productId: item.productId, warehouseId },
    },
  });

  if ((inventory?.quantity ?? 0) < quantity) {
    throw new ConflictException(
      `Stock insuficiente para el producto ${item.product.code} en la bodega`,
    );
  }
}

/** Re-pondera el avgCost sobre el stock global ANTES de la entrada. */
export async function computeNewAvgCost(
  tx: Prisma.TransactionClient,
  productId: string,
  currentAvgCost: number,
  quantity: number,
  unitCost: number,
) {
  const aggregate = await tx.inventory.aggregate({
    _sum: { quantity: true },
    where: { productId },
  });
  const globalStock = aggregate._sum.quantity ?? 0;
  const denominator = globalStock + quantity;

  if (denominator <= 0) return unitCost;

  return (globalStock * currentAvgCost + quantity * unitCost) / denominator;
}
