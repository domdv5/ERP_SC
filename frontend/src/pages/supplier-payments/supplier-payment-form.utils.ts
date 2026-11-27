import type { SupplierPaymentCredit } from '@contracts/supplier-payments'
import { docNumber, formatBogotaDate, formatDateOnly } from '@/lib/format'

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

type SupplierCreditOrigin = Pick<SupplierPaymentCredit, 'kind' | 'number' | 'date' | 'createdAt'>

// Un excedente no tiene documento de origen: su identidad es el consecutivo EXC
export function getExcessCreditLabel(credit: SupplierCreditOrigin): string | null {
  return credit.kind === 'excedente' && credit.number ? docNumber('EXC', credit.number) : null
}

// El excedente trae su propia fecha (solo día); la nota de DVC usa la de creación
export function formatSupplierCreditDate(credit: SupplierCreditOrigin): string {
  return credit.kind === 'excedente' && credit.date
    ? formatDateOnly(credit.date)
    : formatBogotaDate(credit.createdAt)
}
