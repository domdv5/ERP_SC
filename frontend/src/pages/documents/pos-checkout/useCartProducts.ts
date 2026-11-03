import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { getProductByCode } from '@/services/products.service'
import { findPriceFloorViolations } from '@/pages/documents/pos-checkout.utils'
import type { FormValues } from '@/pages/documents/document-form.schema'

// El escaneo no trae precio mínimo ni producto completo; se pide el detalle de cada código del carrito aparte.
export function useCartProducts(cartItems: FormValues['items']) {
  // Clave por códigos, no por referencia: elegir producto en una fila vacía no cambia la referencia del arreglo
  const codesKey = JSON.stringify(cartItems.map((i) => i.productCode ?? ''))
  const uniqueProductCodes = useMemo(
    () => Array.from(new Set((JSON.parse(codesKey) as string[]).filter(Boolean))),
    [codesKey],
  )

  const productDetailQueries = useQueries({
    queries: uniqueProductCodes.map((code) => ({
      queryKey: ['product-by-code', code],
      queryFn: () => getProductByCode(code),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const productDetailByCode = useMemo(() => {
    const map = new Map<string, { minSalePrice: number; availableStock: number; id: string }>()
    productDetailQueries.forEach((q) => {
      if (q.data) map.set(q.data.code, q.data)
    })
    return map
  }, [productDetailQueries])

  const minSalePriceByProductId = useMemo(() => {
    const map = new Map<string, number>()
    productDetailByCode.forEach((p) => map.set(p.id, p.minSalePrice))
    return map
  }, [productDetailByCode])

  const priceFloorViolations = findPriceFloorViolations(
    cartItems
      .filter((i) => i.productId)
      .map((i) => ({
        productId: i.productId,
        code: i.productCode,
        unitPrice: Number(i.unitPrice ?? 0),
      })),
    minSalePriceByProductId,
  )

  return { productDetailByCode, minSalePriceByProductId, priceFloorViolations }
}
