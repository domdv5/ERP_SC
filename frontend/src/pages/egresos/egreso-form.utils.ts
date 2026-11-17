// "Usar todo": lo que falta cubrir de los abonos tras los otros saldos, sin pasar del saldo propio
export function calculateFillCreditAmount(
  balance: number,
  totalAbonos: number,
  othersSum: number,
): number {
  return Math.max(0, Math.min(balance, totalAbonos - othersSum))
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
