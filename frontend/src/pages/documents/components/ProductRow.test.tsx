// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFieldArray, useForm } from 'react-hook-form'
import type { FormValues } from '@/pages/documents/document-form.schema'
import type { DocumentType } from '@/types/document.types'
import type { ProductListItem } from '@/types/product.types'
import { getProducts } from '@/services/products.service'
import { ProductRow } from './ProductRow'

vi.mock('@/services/products.service', () => ({ getProducts: vi.fn() }))

// availableStock (total) y availableToSell (tienda) difieren a propósito
const product = {
  id: 'p1',
  code: 'ABC',
  description: 'Camisa',
  brandId: 'b1',
  avgCost: '1000',
  lastCost: '1000',
  salePrice: 2000,
  unitOfMeasure: 'unidad',
  stockByWarehouse: [],
  availableStock: 99,
  availableToSell: 7,
} as unknown as ProductListItem

const emptyRow = { productId: '', productCode: '', productDesc: '', quantity: 1 }

function Harness({ docType, initialAvailableToSell, items = [emptyRow], index = 0 }: HarnessProps) {
  const { register, control, setValue, watch, getValues } = useForm<FormValues>({
    defaultValues: { items } as Partial<FormValues>,
  })
  const { remove } = useFieldArray({ control, name: 'items' })
  return (
    <table>
      <tbody>
        <ProductRow
          index={index}
          docType={docType}
          onRemove={() => remove(index)}
          register={register}
          control={control}
          setValue={setValue}
          watch={watch}
          getValues={getValues}
          initialAvailableToSell={initialAvailableToSell}
        />
      </tbody>
      <tfoot>
        <tr>
          <td data-testid="rows">
            {watch('items')
              .map((item) => `${item.productId || '-'}x${item.quantity}`)
              .join(',')}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

interface HarnessProps {
  docType: DocumentType
  initialAvailableToSell?: number
  items?: Partial<FormValues['items'][number]>[]
  index?: number
}

function renderRow(props: HarnessProps) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness {...props} />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ProductRow — disponible en ventas', () => {
  it('muestra el disponible de venta del producto buscado y elegido, no el total', async () => {
    vi.mocked(getProducts).mockResolvedValue({ items: [product] } as never)
    renderRow({ docType: 'PV' })

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'ABC' } })

    const option = await screen.findByText('Disponible: 7')
    expect(screen.queryByText(/99/)).toBeNull()

    fireEvent.click(option)
    expect(screen.getByRole('button', { name: 'Disponible: 7' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /99/ })).toBeNull()
  })

  it('usa el disponible de venta recibido del escaneo para el aviso inicial', () => {
    renderRow({ docType: 'PV', initialAvailableToSell: 7 })
    expect(screen.getByRole('button', { name: 'Disponible: 7' })).toBeTruthy()
  })
})

const rowOf = (productId: string, quantity: number) => ({
  productId,
  productCode: productId.toUpperCase(),
  productDesc: 'x',
  quantity,
})

describe('ProductRow — aviso de disponible suma filas repetidas', () => {
  it('compara contra la suma de todas las filas del mismo producto', () => {
    renderRow({
      docType: 'REM',
      initialAvailableToSell: 5,
      items: [rowOf('p1', 3), rowOf('p2', 1), rowOf('p1', 3)],
      index: 2,
    })
    expect(screen.getByRole('button', { name: 'Supera el disponible (5)' })).toBeTruthy()
  })

  it('una sola fila que alcanza no avisa', () => {
    renderRow({
      docType: 'REM',
      initialAvailableToSell: 5,
      items: [rowOf('p1', 3), rowOf('p2', 1)],
      index: 0,
    })
    expect(screen.getByRole('button', { name: 'Disponible: 5' })).toBeTruthy()
  })
})

async function pickProduct() {
  vi.mocked(getProducts).mockResolvedValue({ items: [product] } as never)
  fireEvent.click(screen.getByRole('combobox'))
  fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'ABC' } })
  fireEvent.click(await screen.findByText('Disponible: 7'))
}

describe('ProductRow — elegir producto a mano', () => {
  it('tipo que separa: el producto de la fila anterior se suma y la fila vacía se quita', async () => {
    renderRow({ docType: 'REM', items: [rowOf('p2', 1), rowOf('p1', 2), emptyRow], index: 2 })
    await pickProduct()
    await vi.waitFor(() => expect(screen.getByTestId('rows').textContent).toBe('p2x1,p1x3'))
  })

  it('tipo que separa: un producto de una fila anterior más atrás queda en su propia fila', async () => {
    renderRow({ docType: 'REM', items: [rowOf('p1', 2), rowOf('p2', 1), emptyRow], index: 2 })
    await pickProduct()
    await vi.waitFor(() => expect(screen.getByTestId('rows').textContent).toBe('p1x2,p2x1,p1x1'))
  })

  it('tipo que agrupa: se suma en la fila existente aunque no sea la anterior', async () => {
    renderRow({ docType: 'PV', items: [rowOf('p1', 2), rowOf('p2', 1), emptyRow], index: 2 })
    await pickProduct()
    await vi.waitFor(() => expect(screen.getByTestId('rows').textContent).toBe('p1x3,p2x1'))
  })
})
