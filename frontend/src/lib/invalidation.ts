import type { QueryClient } from '@tanstack/react-query'

function invalidateByPrefix(queryClient: QueryClient, prefix: string) {
  queryClient.invalidateQueries({
    predicate: (query) =>
      typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith(prefix),
  })
}

function invalidateKeys(queryClient: QueryClient, keys: string[]) {
  keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
}

// Prefijo 'product' alcanza todas las claves con stock/costo: products, products-search(-pos), product-by-code, product-locations
export function invalidateProducts(queryClient: QueryClient) {
  invalidateByPrefix(queryClient, 'product')
}

// El cupo de crédito se edita en la ficha del tercero
export function invalidateThirdParties(queryClient: QueryClient) {
  invalidateByPrefix(queryClient, 'third-parties')
  queryClient.invalidateQueries({ queryKey: ['customer-credit'] })
}

// Prefijo único 'inventory-cases': lista, detalle, informe y contador del menú.
export function invalidateInventoryCases(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['inventory-cases'] })
}

// Crear, confirmar, anular, convertir, liberar o eliminar un documento puede tocar stock, cartera, saldos a favor y el libro oficial
export function invalidateAfterDocumentChange(
  queryClient: QueryClient,
  documentIds: (string | null | undefined)[] = [],
) {
  invalidateKeys(queryClient, [
    'documents',
    'documents-count',
    'warehouses',
    'accounts-payable',
    'accounts-receivable',
    'customer-credit',
    'customer-available-credits',
    'supplier-payments-open-items',
    'customer-payments-open-items',
    'official-ledger',
    'official-purchases-pending',
  ])
  invalidateProducts(queryClient)
  // La columna Cupo de Terceros depende de la deuda del cliente
  invalidateThirdParties(queryClient)
  // Confirmar o anular una EAI abre o cierra casos de diferencias.
  invalidateInventoryCases(queryClient)
  documentIds.forEach((id) => {
    if (id) queryClient.invalidateQueries({ queryKey: ['document', id] })
  })
}

// Anular un recibo de caja devuelve saldo a las CxC y a los saldos a favor, y puede desbloquear la anulación de la venta
export function invalidateAfterCustomerPaymentVoid(queryClient: QueryClient) {
  invalidateKeys(queryClient, [
    'customer-payments',
    'customer-payments-open-items',
    'accounts-receivable',
    'customer-credit',
    'customer-available-credits',
    'credits',
    'excesses',
    'documents',
    'document',
  ])
  invalidateThirdParties(queryClient)
}

// Registrar o anular un excedente cambia saldos a favor y lo que ofrecen los recibos y egresos
export function invalidateAfterExcessChange(queryClient: QueryClient) {
  invalidateKeys(queryClient, [
    'excesses',
    'credits',
    'accounts-receivable',
    'accounts-payable',
    'customer-available-credits',
    'customer-payments-open-items',
    'supplier-payments-open-items',
  ])
}
