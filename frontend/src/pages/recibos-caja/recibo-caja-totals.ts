const toCents = (value: string) => Math.round(Number(value) * 100)

// Plata de una cuenta = abonado − saldo a favor − descuento; null en recibos anteriores al reparto (no se guardó)
export function calculateAllocationCash(allocation: {
  amount: string
  creditAmount: string | null
  discountAmount: string
}): number | null {
  if (allocation.creditAmount === null) return null
  return (
    (toCents(allocation.amount) -
      toCents(allocation.creditAmount) -
      toCents(allocation.discountAmount)) /
    100
  )
}

export function sumAmounts(items: { amount: string }[]): number {
  return items.reduce((sum, item) => sum + toCents(item.amount), 0) / 100
}
