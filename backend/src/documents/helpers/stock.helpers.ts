import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DocumentWithItems } from '@/documents/strategies/document-effect.strategy';

/**
 * Aplica el delta a Inventory de forma atómica en una única sentencia SQL
 * (INSERT ... ON CONFLICT DO UPDATE / UPDATE ... WHERE), en vez de leer y
 * luego escribir en dos pasos separados. Esto evita el lost-update y el
 * oversell bajo confirmaciones concurrentes del mismo (productId, warehouseId):
 * el propio UPDATE/ON CONFLICT DO UPDATE toma el lock de fila por la
 * duración de la sentencia, así que Postgres serializa los deltas en vez de
 * que la segunda transacción sobrescriba el resultado de la primera.
 */
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
    // Un incremento siempre es seguro aunque la fila no exista todavía:
    // ON CONFLICT DO UPDATE crea la fila con la cantidad inicial.
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

  // Un decremento sobre una fila inexistente no tiene sentido (no puede
  // haber stock negativo de una fila que nunca existió), así que se usa
  // UPDATE simple (no INSERT). El WHERE valida en la misma sentencia que
  // el resultado no sea negativo, haciendo el chequeo de suficiencia
  // atómico con la escritura.
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

/**
 * Aplica el delta a BinStock de forma atómica (mismo patrón que
 * applyStockChange). No devuelve previousStock/newStock — su firma pública
 * ya no los exponía antes de este cambio, y sus llamadores descartan el
 * valor de retorno.
 */
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
