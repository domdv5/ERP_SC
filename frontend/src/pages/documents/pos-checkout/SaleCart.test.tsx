// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import type { FormValues } from '@/pages/documents/document-form.schema'
import type { ProductByCode } from '@/types/product.types'
import { getProductByCode, getProducts } from '@/services/products.service'
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

type CartRow = Partial<FormValues['items'][number]>

const abcRow = (quantity: number): CartRow => ({
  productId: 'p1',
  productCode: 'ABC',
  productDesc: 'Camisa',
  quantity,
  unitPrice: 2000,
})
const otherRow: CartRow = {
  productId: 'p2',
  productCode: 'XYZ',
  productDesc: 'Pantalón',
  quantity: 1,
  unitPrice: 3000,
}
const emptyRow: CartRow = { productId: '', productCode: '', productDesc: '', quantity: 1 }

// Arma el carrito con el mismo cableado de la página: detalle por código → SaleCart
function Harness({ official, items }: { official: boolean; items: CartRow[] }) {
  const form = useForm<FormValues>({
    defaultValues: { items } as Partial<FormValues>,
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' })
  const cartItems = form.watch('items')
  const { productDetailByCode, minSalePriceByProductId } = useCartProducts(cartItems)
  return (
    <>
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
      <p data-testid="rows">
        {cartItems.map((item) => `${item.productId || '-'}x${item.quantity}`).join(',')}
      </p>
    </>
  )
}

function renderCart(official: boolean, items: CartRow[] = [abcRow(1)]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness official={official} items={items} />
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

describe('SaleCart — filas repetidas del mismo producto', () => {
  it('el aviso de disponible suma todas las filas del producto', async () => {
    vi.mocked(getProductByCode).mockResolvedValue(productDetail)
    renderCart(false, [abcRow(4), otherRow, abcRow(4)])

    const warnings = await screen.findAllByRole('button', { name: 'Supera el disponible (7)' })
    expect(warnings).toHaveLength(2)
  })

  async function pickAbc() {
    vi.mocked(getProducts).mockResolvedValue({
      items: [{ ...productDetail, description: 'Camisa', salePrice: 2000 }],
    } as never)
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'ABC' } })
    fireEvent.click(await screen.findByText('ABC — Camisa'))
  }

  it('elegir a mano el producto de la fila anterior suma la cantidad', async () => {
    vi.mocked(getProductByCode).mockResolvedValue(productDetail)
    renderCart(false, [otherRow, abcRow(2), emptyRow])
    await pickAbc()
    await vi.waitFor(() => expect(screen.getByTestId('rows').textContent).toBe('p2x1,p1x3'))
  })

  it('elegir a mano un producto de una fila más atrás deja su propia fila', async () => {
    vi.mocked(getProductByCode).mockResolvedValue(productDetail)
    renderCart(false, [abcRow(2), otherRow, emptyRow])
    await pickAbc()
    await vi.waitFor(() => expect(screen.getByTestId('rows').textContent).toBe('p1x2,p2x1,p1x1'))
  })
})
