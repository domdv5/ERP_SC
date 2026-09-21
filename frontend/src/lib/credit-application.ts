// Reparto de saldos a favor, compartido entre checkout POS/COT y Egresos; genérico sobre `id`, cada llamador mapea al campo de su payload.

export interface CreditBalance {
  id: string
  balance: number
}

export interface AppliedCredit {
  id: string
  amount: number
}

// Recorre los saldos en el orden recibido (más antiguo primero) asignando el mínimo entre saldo y lo que falta, hasta cubrir el total.
export function proposeCreditApplication(credits: CreditBalance[], total: number): AppliedCredit[] {
  let remaining = Math.max(total, 0)
  const result: AppliedCredit[] = []
  for (const credit of credits) {
    if (remaining <= 0) break
    const amount = Math.min(credit.balance, remaining)
    if (amount <= 0) continue
    result.push({ id: credit.id, amount })
    remaining -= amount
  }
  return result
}

// Tope para un cambio manual del monto aplicado de un saldo a favor: no puede ser negativo, ni
// pasar de su propio saldo, ni hacer que la suma de todos los saldos aplicados supere el total.
export function clampCreditAmount(
  next: number,
  creditBalance: number,
  total: number,
  othersSum: number,
): number {
  if (Number.isNaN(next) || next < 0) return 0
  const ceiling = Math.min(creditBalance, Math.max(total - othersSum, 0))
  return Math.min(next, ceiling)
}

// Recorte final de la lista de saldos aplicados para que su suma nunca supere el total (por si
// el total bajó después de fijar los montos). Recorta desde el último.
export function capCreditsToTotal(credits: AppliedCredit[], total: number): AppliedCredit[] {
  let budget = Math.max(total, 0)
  const result: AppliedCredit[] = []
  for (const credit of credits) {
    if (budget <= 0) break
    const amount = Math.min(credit.amount, budget)
    if (amount <= 0) continue
    result.push({ ...credit, amount })
    budget -= amount
  }
  return result
}
