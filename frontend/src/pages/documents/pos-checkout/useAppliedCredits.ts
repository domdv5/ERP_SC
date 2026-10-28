import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAvailableCustomerCredits } from '@/services/documents.service'
import {
  suggestCreditAmounts,
  limitCreditAmount,
  limitCreditsToTotal,
} from '@/lib/credit-application'
import type { SelectedCredit } from '@/pages/documents/pos-checkout.utils'

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

  const availableCredits = official ? [] : (availableCreditsData?.credits ?? [])
  // Monto aplicado por cada saldo a favor (id del saldo → monto). El usuario puede bajarlo.
  const [creditAmounts, setCreditAmounts] = useState<Record<string, number>>({})
  // Por-crédito, no global: tocar un saldo no congela la propuesta de los demás, que sigue recalculando mientras sube el total.
  const creditsTouchedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    creditsTouchedRef.current = new Set()
  }, [thirdPartyId])

  // Propone aplicar el máximo posible (los saldos más antiguos primero, excluyendo los ya
  // tocados a mano) hasta cubrir lo que falta del total tras descontar lo aplicado a mano.
  useEffect(() => {
    setCreditAmounts((prev) => {
      const touched = creditsTouchedRef.current
      const manuallyAppliedSum = availableCredits
        .filter((c) => touched.has(c.id))
        .reduce((sum, c) => sum + Math.max(0, Math.min(prev[c.id] ?? 0, c.balance)), 0)
      const remaining = Math.max(total - manuallyAppliedSum, 0)
      const proposal = suggestCreditAmounts(
        availableCredits.filter((c) => !touched.has(c.id)),
        remaining,
      )

      const next: Record<string, number> = {}
      availableCredits.forEach((c) => {
        next[c.id] = touched.has(c.id) ? (prev[c.id] ?? 0) : 0
      })
      proposal.forEach((p) => {
        next[p.id] = p.amount
      })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thirdPartyId, availableCreditsData, total, official])

  const balanceByCreditId = new Map(availableCredits.map((c) => [c.id, c.balance]))
  // Lista final aplicada: cada monto recortado a su saldo, y la suma recortada al total.
  const selectedCredits: SelectedCredit[] = limitCreditsToTotal(
    availableCredits
      .map((c) => ({
        id: c.id,
        amount: Math.max(0, Math.min(creditAmounts[c.id] ?? 0, c.balance)),
      }))
      .filter((c) => c.amount > 0),
    total,
  ).map((c) => ({ customerCreditId: c.id, amount: c.amount }))
  const creditsApplied = selectedCredits.reduce((sum, c) => sum + c.amount, 0)
  const totalToPay = Math.max(grandTotal - creditsApplied, 0)

  function setCreditAmount(creditId: string, next: number) {
    creditsTouchedRef.current.add(creditId)
    setCreditAmounts((prev) => {
      const balance = balanceByCreditId.get(creditId) ?? 0
      const othersSum = Object.entries(prev)
        .filter(([id]) => id !== creditId)
        .reduce((sum, [, amt]) => sum + amt, 0)
      return { ...prev, [creditId]: limitCreditAmount(next, balance, total, othersSum) }
    })
  }

  return {
    availableCredits,
    totalAvailable: availableCreditsData?.totalAvailable ?? 0,
    creditAmounts,
    setCreditAmount,
    selectedCredits,
    creditsApplied,
    totalToPay,
  }
}
