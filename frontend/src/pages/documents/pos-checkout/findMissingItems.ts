import { arePaymentsValid, type PaymentLine } from '@/pages/documents/pos-checkout.utils'

interface FindMissingItemsInput {
  thirdPartyId: string
  isLoadingBranches: boolean
  needsBranch: boolean
  customerBranchId: string
  sellerId: string
  needsPayments: boolean
  paymentLines: PaymentLine[]
  totalToPay: number
  hasValidItems: boolean
  hasPriceFloorViolations: boolean
  isCredit: boolean
  isLoadingCredit: boolean
  creditExceeded: boolean
}

// Lista de pendientes que bloquean "Confirmar venta"; vacía = se puede confirmar.
export function findMissingItems(input: FindMissingItemsInput): string[] {
  const missingItems: string[] = []
  if (!input.thirdPartyId) missingItems.push('Selecciona un cliente')
  if (input.thirdPartyId && input.isLoadingBranches)
    missingItems.push('Cargando sucursales del cliente...')
  if (input.needsBranch && !input.customerBranchId)
    missingItems.push('Selecciona la sucursal del cliente')
  if (!input.sellerId) missingItems.push('Selecciona una vendedora')
  if (input.needsPayments && input.paymentLines.some((line) => !line.method))
    missingItems.push('Selecciona una forma de pago')
  if (input.needsPayments && !arePaymentsValid(input.paymentLines, input.totalToPay))
    missingItems.push('Las formas de pago deben sumar el total a cobrar')
  if (!input.hasValidItems) missingItems.push('Agrega al menos un producto con cantidad válida')
  if (input.hasPriceFloorViolations)
    missingItems.push('Corrige los precios por debajo del mínimo permitido')
  if (input.isCredit && input.thirdPartyId && input.isLoadingCredit)
    missingItems.push('Cargando cupo de crédito del cliente...')
  if (input.creditExceeded)
    missingItems.push('La venta supera el cupo de crédito disponible del cliente')
  return missingItems
}
