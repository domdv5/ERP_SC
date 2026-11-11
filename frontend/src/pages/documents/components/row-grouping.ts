import type { DocumentType } from '@/types/document.types'

// Tipos donde el mismo producto solo se agrupa con la fila anterior; el resto deja una fila por producto
const SEPARATE_ROW_TYPES: readonly DocumentType[] = ['REM', 'COT', 'POS', 'POSO', 'DVV']

export function separatesRows(docType: DocumentType) {
  return SEPARATE_ROW_TYPES.includes(docType)
}

interface ProductRowLike {
  productId?: string
  quantity?: unknown
}

// Fila donde sumar un producto recién escaneado; -1 = agregar fila nueva
export function findRowIndexToAdd(
  rows: ProductRowLike[],
  docType: DocumentType,
  productId: string,
) {
  if (!separatesRows(docType)) return rows.findIndex((row) => row.productId === productId)
  return rows.length > 0 && rows[rows.length - 1].productId === productId ? rows.length - 1 : -1
}

// Fila donde sumar un producto elegido a mano en la fila `index` (que se descarta); -1 = queda en su fila
export function findRowIndexToPick(
  rows: ProductRowLike[],
  docType: DocumentType,
  productId: string,
  index: number,
) {
  if (!separatesRows(docType)) {
    return rows.findIndex((row, i) => row.productId === productId && i !== index)
  }
  return index > 0 && rows[index - 1].productId === productId ? index - 1 : -1
}

// Cantidad total del producto sumando todas sus filas (para comparar contra el disponible)
export function sumQuantityByProduct(rows: ProductRowLike[], productId: string | undefined) {
  if (!productId) return 0
  return rows.reduce(
    (sum, row) => (row.productId === productId ? sum + (Number(row.quantity) || 0) : sum),
    0,
  )
}
