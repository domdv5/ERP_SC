// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import type { FormValues } from '@/pages/documents/document-form.schema'
import type { ProductByCode } from '@/types/product.types'
import { getProductByCode } from '@/services/products.service'
import { SaleCart } from './SaleCart'
import { useCartProducts } from './useCartProducts'

vi.mock('@/services/products.service', () => ({
  getProductByCode: vi.fn(),
  getProducts: vi.fn(),
}))

// availableStock (total) y availableToSell (tienda) difieren a propósito
const productDetail = {
  id: 'p1',
  code: 'ABC',
  minSalePrice: 1960,
  availableStock: 99,
  availableToSell: 7,
} as unknown as ProductByCode

// Arma el carrito con el mismo cableado de la página: detalle por código → SaleCart
function Harness({ official }: { official: boolean }) {
  const form = useForm<FormValues>({
    defaultValues: {
      items: [
        {
          productId: 'p1',
          productCode: 'ABC',
          productDesc: 'Camisa',
          quantity: 1,
          unitPrice: 2000,
        },
      ],
    } as Partial<FormValues>,
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const cartItems = form.watch('items')
  const { productDetailByCode, minSalePriceByProductId } = useCartProducts(cartItems)
  return (
    <SaleCart
      docType="POS"
      official={official}
      form={form}
      fields={fields}
      append={append}
      remove={remove}
      cartItems={cartItems}
      productDetailByCode={productDetailByCode}
      minSalePriceByProductId={minSalePriceByProductId}
      onScanPendingChange={() => {}}
    />
  )
}

function renderCart(official: boolean) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness official={official} />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SaleCart — disponible en ventas', () => {
  it('muestra el disponible de venta del detalle del producto, no el total', async () => {
    vi.mocked(getProductByCode).mockResolvedValue(productDetail)
    renderCart(false)

    expect(await screen.findByRole('button', { name: 'Disponible: 7' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /99/ })).toBeNull()
  })

  it('no muestra disponible en la venta oficial', async () => {
    vi.mocked(getProductByCode).mockResolvedValue(productDetail)
    renderCart(true)

    await vi.waitFor(() => expect(getProductByCode).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /Disponible/ })).toBeNull()
  })
})
