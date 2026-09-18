// Cálculos de negocio del formulario de Egresos. Puramente informativos: el backend vuelve a
// calcular todo esto en la transacción real (ver `EgresosService`); acá solo se muestra al
// usuario una vista previa consistente antes de enviar.

export interface PayableAllocationPreview {
  accountPayableId: string
  // Abono total que el usuario propone para esa CxP.
  amount: number
  // Parte de `amount` que este reparto cubre con saldo a favor.
  creditAmount: number
  // Parte de `amount` que queda por cubrir con dinero (formas de pago).
  cashAmount: number
}

// Vista previa del reparto FIFO del saldo a favor entre las CxP seleccionadas: el backend
// reparte el saldo a favor total aplicado empezando por la CxP más antigua (mismo orden en que
// llegan de `GET /egresos/suppliers/:id/open-items`, createdAt asc). Cada CxP se cubre primero
// con saldo a favor hasta agotar el pool o el abono de esa fila; el resto queda a dinero.
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

// Dinero a pagar = total de abonos − saldo a favor aplicado. Nunca negativo: si el saldo a
// favor alcanza a cubrir todo, el excedente simplemente no se aplica (se valida aparte que el
// saldo a favor aplicado nunca supere el total de abonos).
export function computeDineroAPagar(totalAbonos: number, totalCreditsApplied: number): number {
  return Math.max(totalAbonos - totalCreditsApplied, 0)
}

// Tope para el abono editable de una fila de CxP: no puede ser negativo ni superar su saldo.
export function clampPayableAmount(next: number, balance: number): number {
  if (Number.isNaN(next) || next < 0) return 0
  return Math.min(next, balance)
}
