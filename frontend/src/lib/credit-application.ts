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

// Primer saldo marcado que ya no cabe en lo pendiente (-1 si todos caben); cada pantalla calcula su propio pendiente.
export function findCreditOverflowIndex(amounts: number[], pending: number): number {
  let total = 0
  for (let i = 0; i < amounts.length; i++) {
    if (amounts[i] <= 0) continue
    total += amounts[i]
    if (Math.round(total * 100) > Math.round(pending * 100)) return i
  }
  return -1
}
