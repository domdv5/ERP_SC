import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCreditLimit } from '@/services/documents.service'
import { parseCreditLimitError } from '@/pages/documents/pos-checkout.utils'
import type { CreditLimitExceededDetail } from '@/types/document.types'
import type { SaleMode } from './useSaleMode'
import { findApiErrorMessage } from '@/lib/api-error'

// Cupo de crédito del cliente (modo crédito o POS con línea de pago "Crédito") y el error de cupo excedido que devuelve el backend.
export function useCreditLimit(
  mode: SaleMode,
  isCredit: boolean,
  thirdPartyId: string,
  hasCreditLine = false,
) {
  const {
    data: creditData,
    isLoading: isLoadingCredit,
    isError: isCreditQueryError,
    refetch: refetchCredit,
  } = useQuery({
    queryKey: ['customer-credit', thirdPartyId],
    queryFn: () => getCreditLimit(thirdPartyId),
    enabled: (isCredit || hasCreditLine) && Boolean(thirdPartyId),
    staleTime: 30 * 1000,
  })

  // Error de cupo excedido del backend (create/confirm/convert); cubre la carrera entre ventas del mismo cliente.
  const [creditError, setCreditError] = useState<{
    message: string
    detail: CreditLimitExceededDetail
  } | null>(null)

  // Cualquier cambio de contexto borra el error de cupo ya mostrado (el usuario cambió de
  // cliente, de modo, o ajustó el carrito y va a reintentar).
  useEffect(() => {
    setCreditError(null)
  }, [mode, thirdPartyId])

  // Pasa un error de cupo excedido al panel de error dedicado; devuelve true si lo manejó.
  function handleCreditError(err: unknown): boolean {
    const credit = parseCreditLimitError(err)
    if (!credit) return false
    setCreditError({
      message: findApiErrorMessage(err) ?? 'Cupo de crédito insuficiente',
      detail: credit,
    })
    return true
  }

  function clearCreditError() {
    setCreditError(null)
  }

  return {
    creditData,
    isLoadingCredit,
    isCreditQueryError,
    refetchCredit,
    creditError,
    clearCreditError,
    handleCreditError,
  }
}
