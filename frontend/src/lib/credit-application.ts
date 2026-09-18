// Cálculo de reparto de saldos a favor (créditos), compartido entre el checkout POS/COT
// (saldos a favor de cliente) y el formulario de Egresos (saldos a favor de proveedor). Trabaja
// sobre un `id` genérico; cada llamador lo mapea al nombre de campo que espera su propio
// payload (`customerCreditId` / `supplierCreditId`).

export interface CreditBalance {
  id: string
  balance: number
}

export interface AppliedCredit {
  id: string
  amount: number
}

// Propuesta por defecto para aplicar saldos a favor a un total: recorre los saldos en el orden
// recibido (se espera del más antiguo al más nuevo) y asigna a cada uno el menor entre su saldo
// y lo que todavía falta para cubrir el total. Se detiene al cubrirlo.
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
