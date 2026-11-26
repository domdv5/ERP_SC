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

// Lo que falta cobrar en plata para un saldo: abonos − descuento − los otros saldos ya marcados
export function calculateCreditPending(
  totalAbonos: number,
  discount: number,
  creditAmounts: number[],
  index: number,
): number {
  const othersSum = creditAmounts.reduce((sum, amount, i) => (i === index ? sum : sum + amount), 0)
  return Math.max(totalAbonos - discount - othersSum, 0)
}
