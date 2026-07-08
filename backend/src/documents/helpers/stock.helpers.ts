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
  },
) {
  const { productId, warehouseId, delta } = params;

  const inventory = await tx.inventory.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });

  const previousStock = inventory?.quantity ?? 0;
  const newStock = previousStock + delta;

  await tx.inventory.upsert({
    where: { productId_warehouseId: { productId, warehouseId } },
    create: { productId, warehouseId, quantity: newStock },
    update: { quantity: newStock },
  });

  return { previousStock, newStock };
}

/** Lee el BinStock actual del par (producto, bin), aplica el delta y upserta. */
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

  const binStock = await tx.binStock.findUnique({
    where: { productId_binId: { productId, binId } },
  });

  const newQuantity = (binStock?.quantity ?? 0) + delta;

  await tx.binStock.upsert({
    where: { productId_binId: { productId, binId } },
    create: { productId, binId, warehouseId, quantity: newQuantity },
    update: { quantity: newQuantity },
  });
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
