import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAvailableCustomerCredits } from '@/services/documents.service'
import {
  canUseCredit,
  keepCreditsWithinTotal,
  suggestCreditAmounts,
} from '@/lib/credit-application'
import { toNumericCredits, type SelectedCredit } from '@/pages/documents/pos-checkout.utils'

interface UseAppliedCreditsArgs {
  thirdPartyId: string
  official: boolean
  total: number
  grandTotal: number
}

export function useAppliedCredits({
  thirdPartyId,
  official,
  total,
  grandTotal,
}: UseAppliedCreditsArgs) {
  // Saldos a favor disponibles del cliente. Se consultan también en contado: un saldo a favor
  // se puede aplicar tanto a una venta de contado como a una a crédito.
  const { data: availableCreditsData } = useQuery({
    queryKey: ['customer-available-credits', thirdPartyId],
    queryFn: () => getAvailableCustomerCredits(thirdPartyId),
    enabled: Boolean(thirdPartyId) && !official,
    staleTime: 30 * 1000,
  })

  const availableCredits = useMemo(
    () => (official ? [] : toNumericCredits(availableCreditsData?.credits ?? [])),
    [official, availableCreditsData],
  )
  // Monto aplicado por cada saldo a favor (id del saldo → 0 o su saldo completo).
  const [creditAmounts, setCreditAmounts] = useState<Record<string, number>>({})
  // Por-crédito, no global: marcar un saldo no congela la propuesta de los demás, que sigue recalculando mientras sube el total.
  const creditsTouchedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    creditsTouchedRef.current = new Set()
  }, [thirdPartyId])

  // Propone los saldos completos más antiguos que caben, sin tocar los marcados a mano (que se sueltan si ya no caben).
  useEffect(() => {
    setCreditAmounts((prev) => {
      const touched = creditsTouchedRef.current
      const manual = keepCreditsWithinTotal(
        availableCredits
          .filter((c) => touched.has(c.id) && (prev[c.id] ?? 0) > 0)
          .map((c) => ({ id: c.id, amount: c.balance })),
        total,
      )
      const manualSum = manual.reduce((sum, c) => sum + c.amount, 0)
      const proposal = suggestCreditAmounts(
        availableCredits.filter((c) => !touched.has(c.id)),
        Math.max(total - manualSum, 0),
      )

      const next: Record<string, number> = {}
      availableCredits.forEach((c) => {
        next[c.id] = 0
      })
      manual.forEach((m) => {
        next[m.id] = m.amount
      })
      proposal.forEach((p) => {
        next[p.id] = p.amount
      })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thirdPartyId, availableCreditsData, total, official])

  // Lista final aplicada: cada saldo marcado va completo y solo entran los que caben en el total.
  const selectedCredits: SelectedCredit[] = keepCreditsWithinTotal(
    availableCredits
      .filter((c) => (creditAmounts[c.id] ?? 0) > 0)
      .map((c) => ({ id: c.id, amount: c.balance })),
    total,
  ).map((c) => ({ customerCreditId: c.id, amount: c.amount }))
  const creditsApplied = selectedCredits.reduce((sum, c) => sum + c.amount, 0)
  const totalToPay = Math.max(grandTotal - creditsApplied, 0)
  const appliedAmounts = Object.fromEntries(
    selectedCredits.map((c) => [c.customerCreditId, c.amount]),
  )

  function setCreditUsed(creditId: string, used: boolean) {
    const balance = availableCredits.find((c) => c.id === creditId)?.balance ?? 0
    creditsTouchedRef.current.add(creditId)
    setCreditAmounts((prev) => ({ ...prev, [creditId]: used ? balance : 0 }))
  }

  // Un saldo marcado siempre se puede soltar; uno sin marcar solo entra si cabe completo en lo que falta.
  function canUseCreditById(creditId: string): boolean {
    if (creditId in appliedAmounts) return true
    const balance = availableCredits.find((c) => c.id === creditId)?.balance ?? 0
    return canUseCredit(balance, total - creditsApplied)
  }

  return {
    availableCredits,
    totalAvailable: availableCreditsData?.totalAvailable ?? 0,
    creditAmounts: appliedAmounts,
    setCreditUsed,
    canUseCredit: canUseCreditById,
    selectedCredits,
    creditsApplied,
    totalToPay,
  }
}
