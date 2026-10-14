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
    'egresos-open-items',
    'recibos-caja-open-items',
    'official-ledger',
    'official-purchases-pending',
  ])
  invalidateProducts(queryClient)
  documentIds.forEach((id) => {
    if (id) queryClient.invalidateQueries({ queryKey: ['document', id] })
  })
}
