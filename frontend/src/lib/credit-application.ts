// Reparto de saldos a favor, compartido entre checkout POS/COT, Recibos y Egresos; genérico sobre `id`, cada llamador mapea al campo de su payload.
// Regla del dueño (2026-11-20): un saldo a favor se usa por todo su disponible o no se usa.

export interface CreditBalance {
  id: string
  balance: number
}

export interface AppliedCredit {
  id: string
  amount: number
}

const toCents = (value: number) => Math.round(value * 100)

export function canUseCredit(balance: number, pending: number): boolean {
  const balanceCents = toCents(balance)
  return balanceCents > 0 && balanceCents <= toCents(pending)
}

// En el orden recibido (más antiguo primero) toma cada saldo completo que todavía cabe en lo que falta.
export function suggestCreditAmounts(credits: CreditBalance[], total: number): AppliedCredit[] {
  let remaining = Math.max(total, 0)
  const result: AppliedCredit[] = []
  for (const credit of credits) {
    if (!canUseCredit(credit.balance, remaining)) continue
    result.push({ id: credit.id, amount: credit.balance })
    remaining -= credit.balance
  }
  return result
}

// Si el total bajó después de marcar saldos, suelta los que ya no caben enteros (desde el último).
export function keepCreditsWithinTotal<T extends AppliedCredit>(credits: T[], total: number): T[] {
  let budget = Math.max(total, 0)
  const result: T[] = []
  for (const credit of credits) {
    if (!canUseCredit(credit.amount, budget)) continue
    result.push({ ...credit })
    budget -= credit.amount
  }
  return result
}
