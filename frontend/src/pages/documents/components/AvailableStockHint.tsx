import { HintText } from '@/components/shared'
import { getAvailableStockHint } from './available-stock'

interface AvailableStockHintProps {
  available: number | null | undefined
  quantity: number
}

// Mismo aviso de disponible en todas las filas de producto (documentos y carrito de venta)
export function AvailableStockHint({ available, quantity }: AvailableStockHintProps) {
  const hint = getAvailableStockHint(available, quantity)
  if (!hint) return null
  return <HintText variant={hint.variant}>{hint.text}</HintText>
}
