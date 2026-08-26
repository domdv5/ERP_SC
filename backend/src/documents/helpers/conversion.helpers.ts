/** Empareja ítems del documento derivado con líneas del documento fuente por productId, sumando cantidades si el producto se repite (el escáner incrementa la fila existente, pero no hay garantía estructural de 1:1). */
export function matchItemsByProduct(
  sourceItems: { id: string; productId: string }[],
  targetItems: { productId: string; quantity: number }[],
): { documentItemId: string; quantity: number }[] {
  const quantityByProduct = new Map<string, number>();

  for (const target of targetItems) {
    quantityByProduct.set(
      target.productId,
      (quantityByProduct.get(target.productId) ?? 0) + target.quantity,
    );
  }

  const result: { documentItemId: string; quantity: number }[] = [];

  for (const sourceItem of sourceItems) {
    const quantity = quantityByProduct.get(sourceItem.productId);
    if (quantity) {
      result.push({ documentItemId: sourceItem.id, quantity });
    }
  }

  return result;
}
