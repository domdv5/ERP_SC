// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
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

function Harness({ docType, initialAvailableToSell }: HarnessProps) {
  const { register, control, setValue, watch, getValues } = useForm<FormValues>({
    defaultValues: {
      items: [{ productId: '', productCode: '', productDesc: '', quantity: 1 }],
    } as Partial<FormValues>,
  })
  return (
    <table>
      <tbody>
        <ProductRow
          index={0}
          docType={docType}
          onRemove={() => {}}
          register={register}
          control={control}
          setValue={setValue}
          watch={watch}
          getValues={getValues}
          initialAvailableToSell={initialAvailableToSell}
        />
      </tbody>
    </table>
  )
}

interface HarnessProps {
  docType: DocumentType
  initialAvailableToSell?: number
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
