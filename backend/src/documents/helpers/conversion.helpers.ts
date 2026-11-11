interface SourceItem {
  id: string;
  productId: string;
  quantity: number;
  releasedQuantity: number;
  convertedQuantity: number;
}

type ItemAssignment = { documentItemId: string; quantity: number };

/** Empareja las líneas del documento derivado con las del origen por producto: suma la cantidad del derivado y la reparte entre las filas del origen. */
function splitByProduct(
  sourceItems: SourceItem[],
  targetItems: { productId: string; quantity: number }[],
  roomIn: (item: SourceItem) => number,
): ItemAssignment[] {
  // Ids v7 ordenados por creación: las filas se llenan en el orden en que se agregaron.
  sourceItems = [...sourceItems].sort((a, b) => a.id.localeCompare(b.id));
  const remainingByProduct = new Map<string, number>();
  for (const target of targetItems) {
    remainingByProduct.set(
      target.productId,
      (remainingByProduct.get(target.productId) ?? 0) + target.quantity,
    );
  }

  const lastRowByProduct = new Map<string, SourceItem>();
  for (const item of sourceItems) lastRowByProduct.set(item.productId, item);

  const assigned = new Map<string, number>();
  for (const item of sourceItems) {
    const remaining = remainingByProduct.get(item.productId) ?? 0;
    if (remaining <= 0) continue;
    const take = Math.min(remaining, Math.max(roomIn(item), 0));
    if (take > 0) assigned.set(item.id, take);
    remainingByProduct.set(item.productId, remaining - take);
  }

  // Lo que no entra en ninguna fila se carga a la última: la base lo rechaza en vez de perderlo en silencio.
  for (const [productId, leftover] of remainingByProduct) {
    const lastRow = lastRowByProduct.get(productId);
    if (leftover > 0 && lastRow) {
      assigned.set(lastRow.id, (assigned.get(lastRow.id) ?? 0) + leftover);
    }
  }

  return sourceItems
    .filter((item) => assigned.has(item.id))
    .map((item) => ({
      documentItemId: item.id,
      quantity: assigned.get(item.id)!,
    }));
}

/** Al confirmar la venta derivada: cada fila del origen recibe hasta su pendiente (cantidad − liberado − convertido). */
export function matchItemsByProduct(
  sourceItems: SourceItem[],
  targetItems: { productId: string; quantity: number }[],
): ItemAssignment[] {
  return splitByProduct(
    sourceItems,
    targetItems,
    (item) => item.quantity - item.releasedQuantity - item.convertedQuantity,
  );
}

/** Al anular la venta derivada: cada fila del origen devuelve hasta lo que tiene convertido. */
export function matchConvertedItemsByProduct(
  sourceItems: SourceItem[],
  targetItems: { productId: string; quantity: number }[],
): ItemAssignment[] {
  return splitByProduct(
    sourceItems,
    targetItems,
    (item) => item.convertedQuantity,
  );
}
