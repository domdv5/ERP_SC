import type { DocumentType } from '@/types/document.types'

// Tipos que se valoran al precio de venta: al agregar un producto se precarga su salePrice
const SALE_PRICE_TYPES: readonly DocumentType[] = ['PV', 'REM', 'DVV', 'POS', 'COT', 'POSO']

export function prefillsSalePrice(docType: DocumentType) {
  return SALE_PRICE_TYPES.includes(docType)
}
