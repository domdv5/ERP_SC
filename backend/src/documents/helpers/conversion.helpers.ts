/**
 * Empareja ítems de un documento derivado con las líneas del documento
 * fuente por productId, sumando cantidades cuando el producto se repite
 * en más de una línea (robustez — el escáner de código de barras hoy
 * incrementa sobre la fila existente en vez de duplicar, pero no hay
 * garantía estructural de 1:1).
 */
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
