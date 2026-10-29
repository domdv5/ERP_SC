import { getDocument, getDocuments } from '@/services/documents.service'
import type {
  CreditLimitExceededDetail,
  DocumentDetail,
  DocumentItem,
  MissingStockItem,
  PaymentMethod,
} from '@/types/document.types'

// ─── preventa pendiente (conversión PV → POS) ─────────────────────────────────

// Misma fórmula que usa el backend para decidir si una preventa todavía tiene reserva activa
export function getPendingQuantity(
  item: Pick<DocumentItem, 'quantity'> &
    Partial<Pick<DocumentItem, 'releasedQuantity' | 'convertedQuantity'>>,
): number {
  return item.quantity - (item.releasedQuantity ?? 0) - (item.convertedQuantity ?? 0)
}

export function hasPendingItems(doc: Pick<DocumentDetail, 'documentItems'>): boolean {
  return doc.documentItems.some((item) => getPendingQuantity(item) > 0)
}

// El listado no trae las líneas, así que se pide el detalle de cada candidata para calcular el pendiente
export async function findActivePendingPreventa(
  thirdPartyId: string,
): Promise<DocumentDetail | null> {
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

export type { MissingStockItem }

export function parseMissingStockError(err: unknown): MissingStockItem[] | null {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (typeof data !== 'object' || data === null) return null
  const missingStock = (data as { missingStock?: unknown }).missingStock
  return Array.isArray(missingStock) ? (missingStock as MissingStockItem[]) : null
}

// ─── saldos a favor del cliente aplicados a una venta ────────────────────────

// El cálculo genérico vive en @/lib/credit-application (compartido con Egresos); acá solo el nombre de campo
export interface SelectedCredit {
  customerCreditId: string
  amount: number
}

// ─── 400 de cupo de crédito excedido (crear/confirmar/convertir COT) ──────────

// Igual que missingStock: el backend responde { message, credit }, credit al lado de message
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

// ─── formas de pago (solo contado) ───────────────────────────────────────────

export interface PaymentLine {
  method: PaymentMethod | ''
  amount: number | undefined
}

// Lo que falta por cubrir (negativo = sobra); en centavos enteros para no arrastrar error de punto flotante.
export function calculatePaymentDifference(lines: PaymentLine[], totalToPay: number): number {
  const toCents = (value: number) => Math.round(value * 100)
  const paidCents = lines.reduce((sum, line) => sum + toCents(line.amount ?? 0), 0)
  return (toCents(totalToPay) - paidCents) / 100
}

// Misma regla que el backend al confirmar: cada fila con forma de pago y monto > 0, sin repetir, y suma exacta.
export function arePaymentsValid(lines: PaymentLine[], totalToPay: number): boolean {
  if (lines.length === 0) return totalToPay === 0
  const methods = lines.map((line) => line.method)
  return (
    lines.every((line) => line.method !== '' && (line.amount ?? 0) > 0) &&
    new Set(methods).size === methods.length &&
    calculatePaymentDifference(lines, totalToPay) === 0
  )
}
