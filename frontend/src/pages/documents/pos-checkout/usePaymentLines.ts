import { useState } from 'react'
import { calculatePaymentDifference, type PaymentLine } from '@/pages/documents/pos-checkout.utils'

export function usePaymentLines(totalToPay: number) {
  const [paymentRows, setPaymentRows] = useState<PaymentLine[]>([{ method: '', amount: undefined }])
  // Mientras haya una sola fila y no se haya tecleado el monto, este sigue al total a cobrar.
  const [isAmountEdited, setIsAmountEdited] = useState(false)

  const paymentLines: PaymentLine[] =
    paymentRows.length === 1 && !isAmountEdited
      ? [{ ...paymentRows[0], amount: totalToPay }]
      : paymentRows
  const paymentDifference = calculatePaymentDifference(paymentLines, totalToPay)

  function updatePaymentRow(index: number, patch: Partial<PaymentLine>) {
    setPaymentRows(paymentLines.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function changePaymentAmount(index: number, amount: number | undefined) {
    setIsAmountEdited(true)
    updatePaymentRow(index, { amount })
  }

  function addPaymentRow() {
    setPaymentRows([
      ...paymentLines,
      { method: '', amount: paymentDifference > 0 ? paymentDifference : undefined },
    ])
  }

  function removePaymentRow(index: number) {
    setIsAmountEdited(true)
    setPaymentRows(paymentLines.filter((_, i) => i !== index))
  }

  return {
    paymentLines,
    paymentDifference,
    setPaymentRows,
    updatePaymentRow,
    changePaymentAmount,
    addPaymentRow,
    removePaymentRow,
  }
}
