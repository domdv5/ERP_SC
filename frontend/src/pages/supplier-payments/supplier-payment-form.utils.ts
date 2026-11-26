// Lo que falta cubrir de los abonos para un saldo: abonos menos los otros saldos ya marcados
export function calculateCreditPending(
  totalAbonos: number,
  creditAmounts: number[],
  index: number,
): number {
  const othersSum = creditAmounts.reduce((sum, amount, i) => (i === index ? sum : sum + amount), 0)
  return Math.max(totalAbonos - othersSum, 0)
}

// Nunca negativo: si el saldo a favor cubre todo, el excedente no se aplica (se valida aparte)
export function calculateAmountToPay(totalAbonos: number, totalCreditsApplied: number): number {
  return Math.max(totalAbonos - totalCreditsApplied, 0)
}

// Tope para el abono editable de una fila de CxP: no puede ser negativo ni superar su saldo.
export function limitPayableAmount(next: number, balance: number): number {
  if (Number.isNaN(next) || next < 0) return 0
  return Math.min(next, balance)
}
