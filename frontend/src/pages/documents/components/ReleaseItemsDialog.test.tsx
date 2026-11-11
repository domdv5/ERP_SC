// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DocumentDetail } from '@/types/document.types'
import { ReleaseItemsDialog } from './ReleaseItemsDialog'

vi.mock('@/services/documents.service', () => ({ releaseItems: vi.fn() }))

afterEach(cleanup)

const item = (id: string, convertedQuantity: number) => ({
  id,
  quantity: 20,
  releasedQuantity: 0,
  convertedQuantity,
  product: { code: id, description: `Producto ${id}` },
})

const renderDialog = (items: ReturnType<typeof item>[]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReleaseItemsDialog
        open
        doc={{ id: 'rem-1', type: 'REM', documentItems: items } as unknown as DocumentDetail}
        onClose={() => {}}
      />
    </QueryClientProvider>,
  )

describe('ReleaseItemsDialog', () => {
  it('el pendiente descuenta lo ya convertido: una fila convertida entera no se puede liberar', () => {
    renderDialog([item('D', 20)])

    expect(screen.getByText(/Convertido: 20/)).toBeTruthy()
    expect(screen.getByText(/Pendiente: 0/)).toBeTruthy()
    expect(screen.getByText('Liberado completamente')).toBeTruthy()
  })

  it('una fila con parte convertida ofrece liberar solo el resto', () => {
    renderDialog([item('D', 5)])

    expect(screen.getByText(/Pendiente: 15/)).toBeTruthy()
  })
})
