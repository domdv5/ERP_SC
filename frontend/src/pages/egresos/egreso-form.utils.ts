// Vista previa informativa; el backend recalcula todo esto de verdad en la transacción real

export interface PayableAllocationPreview {
  accountPayableId: string
  amount: number
  creditAmount: number
  cashAmount: number
}

// Reparto FIFO: cubre cada CxP con saldo a favor primero, en el mismo orden (createdAt asc) que open-items
export function previewCreditAllocation(
  selectedPayables: { accountPayableId: string; amount: number }[],
  totalCreditsApplied: number,
): PayableAllocationPreview[] {
  let remaining = Math.max(totalCreditsApplied, 0)
  return selectedPayables.map((p) => {
    const creditAmount = Math.min(p.amount, Math.max(remaining, 0))
    remaining -= creditAmount
    return {
      accountPayableId: p.accountPayableId,
      amount: p.amount,
      creditAmount,
      cashAmount: p.amount - creditAmount,
    }
  })
}

// Nunca negativo: si el saldo a favor cubre todo, el excedente no se aplica (se valida aparte)
export function computeDineroAPagar(totalAbonos: number, totalCreditsApplied: number): number {
  return Math.max(totalAbonos - totalCreditsApplied, 0)
}

// Tope para el abono editable de una fila de CxP: no puede ser negativo ni superar su saldo.
export function clampPayableAmount(next: number, balance: number): number {
  if (Number.isNaN(next) || next < 0) return 0
  return Math.min(next, balance)
}
