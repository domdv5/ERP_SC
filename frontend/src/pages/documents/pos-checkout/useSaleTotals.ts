import { splitOfficialPrice } from '@/lib/tax'
import type { FormValues } from '@/pages/documents/document-form.schema'

export function useSaleTotals(
  cartItems: FormValues['items'],
  itemCount: number,
  official: boolean,
) {
  const total = cartItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0,
  )
  const hasValidItems =
    itemCount > 0 && cartItems.every((item) => item.productId && Number(item.quantity) > 0)
  const totalUnits = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  // En venta oficial el precio trae IVA: base e IVA se separan por línea sobre su total.
  const officialTotals = cartItems.reduce(
    (acc, item) => {
      const line = splitOfficialPrice(Number(item.quantity || 0), Number(item.unitPrice || 0))
      return {
        subtotal: acc.subtotal + line.subtotal,
        taxTotal: acc.taxTotal + line.taxAmount,
        total: acc.total + line.total,
      }
    },
    { subtotal: 0, taxTotal: 0, total: 0 },
  )
  const grandTotal = official ? officialTotals.total : total

  return { total, hasValidItems, totalUnits, officialTotals, grandTotal }
}
