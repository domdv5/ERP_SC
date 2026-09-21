import { getDocument, getDocuments } from '@/services/documents.service'
import type { CreditLimitExceededDetail, Document, DocumentItem } from '@/types/document.types'

// ─── preventa pendiente (conversión PV → POS) ─────────────────────────────────

// Misma fórmula que usa el backend para decidir si una preventa todavía tiene reserva activa
export function getPendingQuantity(
  item: Pick<DocumentItem, 'quantity' | 'releasedQuantity' | 'convertedQuantity'>,
): number {
  return item.quantity - (item.releasedQuantity ?? 0) - (item.convertedQuantity ?? 0)
}

export function hasPendingItems(doc: Pick<Document, 'documentItems'>): boolean {
  return doc.documentItems.some((item) => getPendingQuantity(item) > 0)
}

// El listado no trae las líneas, así que se pide el detalle de cada candidata para calcular el pendiente
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

// Mismo criterio que el backend, replicado para bloquear en el frontend antes de confirmar
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

// El backend responde { message, shortfalls } al confirmar — shortfalls viaja al lado de message, no dentro
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

// ─── saldos a favor del cliente aplicados a una venta ────────────────────────

// El cálculo genérico vive en @/lib/credit-application (compartido con Egresos); acá solo el nombre de campo
export interface SelectedCredit {
  customerCreditId: string
  amount: number
}

// ─── 400 de cupo de crédito excedido (crear/confirmar/convertir COT) ──────────

// Igual que shortfalls: el backend responde { message, credit }, credit al lado de message
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
