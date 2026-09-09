/** Empareja las líneas del documento derivado con las del documento origen por producto, sumando cantidades si un producto aparece repetido (el escáner suma sobre la fila existente, pero nada garantiza que sean 1 a 1). */
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
