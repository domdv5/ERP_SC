import type { DocumentType } from '@/types/document.types'

// Costo que se prellena al elegir un producto; CMO va sin IVA y SAJ/T no digitan costo, así que no sugieren nada.
// En pesos enteros: ThousandsInput descarta la coma decimal al editar y un valor con decimales se multiplicaría.
export function suggestedUnitCost(
  type: DocumentType,
  product: { avgCost: string | number; lastCost: string | number },
): number | undefined {
  // La compra se parece más a la última factura; DVC y EAI valoran al promedio para no correrlo.
  const source =
    type === 'CM' ? product.lastCost : type === 'DVC' || type === 'EAI' ? product.avgCost : 0
  const cost = Math.round(Number(source))
  return cost > 0 ? cost : undefined
}
