import { getDocument, getDocuments } from '@/services/documents.service'
import type { CreditLimitExceededDetail, Document, DocumentItem } from '@/types/document.types'

// ─── preventa pendiente (conversión PV → POS) ─────────────────────────────────

// Pendiente de una línea de PV: cantidad reservada menos lo ya liberado (release-items) y lo ya
// convertido a una venta real — misma fórmula que usa el backend en documents.service.ts::convert()
// y en void() para decidir si una preventa todavía tiene reserva activa.
export function getPendingQuantity(
  item: Pick<DocumentItem, 'quantity' | 'releasedQuantity' | 'convertedQuantity'>,
): number {
  return item.quantity - (item.releasedQuantity ?? 0) - (item.convertedQuantity ?? 0)
}

export function hasPendingItems(doc: Pick<Document, 'documentItems'>): boolean {
  return doc.documentItems.some((item) => getPendingQuantity(item) > 0)
}

// Busca la primera preventa confirmada de un cliente que todavía tenga cantidad pendiente por
// convertir. GET /documents no devuelve documentItems en el listado (solo _count), así que hay
// que resolver el detalle de cada candidata para calcular el pendiente por línea — el backend no
// expone un endpoint que devuelva "pendiente" precalculado. En la práctica un cliente rara vez
// tiene más de una PV confirmada activa a la vez, por eso resolver unas pocas candidatas en
// paralelo (limit bajo) es aceptable en vez de paginar.
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

// Un unitPrice editado a mano que quede por debajo del minSalePrice vigente del producto es un
// error real — mismo criterio que el backend aplica en PosEffectStrategy.assertPricesAboveFloor,
// replicado acá para bloquear en el frontend antes de que el usuario descubra el error recién al
// confirmar contra el backend (requisito explícito del checkout POS).
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

// Shape estructurado nuevo, distinto del 409 de PV (string plano en message) — no asumir el
// mismo shape para todos los tipos. `PosEffectStrategy.confirm()` lanza
// `new ConflictException({ message: '...', shortfalls })`: Nest usa ese objeto completo como
// cuerpo de la respuesta, así que `shortfalls` viaja como hermano de `message` dentro de
// `response.data` (NO anidado dentro de `message`, que sigue siendo un string). Devuelve null si
// el error no matchea esta forma, para que el caller haga fallback al toast genérico de siempre.
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

// Mismo gotcha que parseStockShortfallError: el backend lanza
// `new BadRequestException({ message, credit })`, así que `credit` viaja como hermano de
// `message` dentro de `response.data`. Devuelve null si el error no matchea esta forma.
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
