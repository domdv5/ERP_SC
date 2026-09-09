import { getDocument, getDocuments } from '@/services/documents.service'
import type { CreditLimitExceededDetail, Document, DocumentItem } from '@/types/document.types'

// ─── preventa pendiente (conversión PV → POS) ─────────────────────────────────

// Pendiente de una línea de preventa: la cantidad reservada menos lo ya liberado y lo ya
// convertido en venta. Es la misma fórmula que usa el backend para decidir si una preventa
// todavía tiene reserva activa.
export function getPendingQuantity(
  item: Pick<DocumentItem, 'quantity' | 'releasedQuantity' | 'convertedQuantity'>,
): number {
  return item.quantity - (item.releasedQuantity ?? 0) - (item.convertedQuantity ?? 0)
}

export function hasPendingItems(doc: Pick<Document, 'documentItems'>): boolean {
  return doc.documentItems.some((item) => getPendingQuantity(item) > 0)
}

// Busca la primera preventa confirmada de un cliente que todavía tenga cantidad pendiente por
// convertir. El listado de documentos no trae las líneas (solo el conteo), así que hay que
// pedir el detalle de cada candidata para calcular el pendiente por línea; el backend no
// expone ese "pendiente" ya calculado. En la práctica un cliente rara vez tiene más de una
// preventa activa a la vez, así que resolver unas pocas en paralelo alcanza sin paginar.
export async function findActivePendingPreventa(thirdPartyId: string): Promise<Document | null> {
  const { items } = await getDocuments({
    type: 'PV',
    status: 'confirmed',
    thirdPartyId,
    limit: 10,
  })
  if (items.length === 0) return null

  const details = await Promise.all(items.map((item) => getDocument(item.id)))
  return details.find(hasPendingItems) ?? null
}

// ─── piso de precio (2%) ───────────────────────────────────────────────────────

// Un precio editado a mano que quede por debajo del precio mínimo actual del producto es un
// error real. Es el mismo criterio que aplica el backend, replicado acá para bloquear en el
// frontend antes de que el usuario se entere recién al confirmar (requisito del checkout).
export interface PriceFloorViolation {
  code: string
  unitPrice: number
  minSalePrice: number
}

export function findPriceFloorViolations(
  lines: { productId: string; code: string; unitPrice: number }[],
  minSalePriceByProductId: Map<string, number>,
): PriceFloorViolation[] {
  return lines
    .filter((line) => line.unitPrice < (minSalePriceByProductId.get(line.productId) ?? 0))
    .map((line) => ({
      code: line.code,
      unitPrice: line.unitPrice,
      minSalePrice: minSalePriceByProductId.get(line.productId) ?? 0,
    }))
}

// ─── 409 de stock insuficiente (POST /documents/:id/confirm, solo POS) ────────

// Forma estructurada, distinta del error de stock de la preventa (que es solo texto en
// `message`): no asumir la misma forma para todos los tipos. Al confirmar una venta, el
// backend responde `{ message, shortfalls }`, así que `shortfalls` viaja al lado de `message`
// (no dentro de él, que sigue siendo texto). Devuelve null si el error no tiene esta forma,
// para que quien llama caiga al aviso genérico de siempre.
export interface StockShortfall {
  productId: string
  code: string
  available: number
  requested: number
}

export function parseStockShortfallError(err: unknown): StockShortfall[] | null {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (typeof data !== 'object' || data === null) return null
  const shortfalls = (data as { shortfalls?: unknown }).shortfalls
  return Array.isArray(shortfalls) ? (shortfalls as StockShortfall[]) : null
}

// ─── 400 de cupo de crédito excedido (crear/confirmar/convertir COT) ──────────

// Mismo detalle que con el error de stock: el backend responde `{ message, credit }`, así que
// `credit` viaja al lado de `message`. Devuelve null si el error no tiene esta forma.
export function parseCreditLimitError(err: unknown): CreditLimitExceededDetail | null {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (typeof data !== 'object' || data === null) return null
  const credit = (data as { credit?: unknown }).credit
  if (typeof credit !== 'object' || credit === null) return null
  const c = credit as Record<string, unknown>
  if (
    typeof c.creditLimit !== 'number' ||
    typeof c.usedCredit !== 'number' ||
    typeof c.availableCredit !== 'number'
  ) {
    return null
  }
  return credit as CreditLimitExceededDetail
}
