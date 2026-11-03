import type { DocumentType } from '@/types/document.types'

const STOCK_OUT_TYPES: readonly DocumentType[] = [
  'PV',
  'REM',
  'T',
  'SAJ',
  'DVC',
  'POS',
  'COT',
  'POSO',
]

// Documentos que sacan mercancía: todos muestran el disponible igual; los de entrada no
export function takesStockOut(docType: DocumentType) {
  return STOCK_OUT_TYPES.includes(docType)
}

export function getAvailableStockHint(available: number | null | undefined, quantity: number) {
  if (available === null || available === undefined) return null
  if (quantity > available) {
    return { variant: 'warning' as const, text: `Supera el disponible (${available})` }
  }
  return { variant: 'positive' as const, text: `Disponible: ${available}` }
}
