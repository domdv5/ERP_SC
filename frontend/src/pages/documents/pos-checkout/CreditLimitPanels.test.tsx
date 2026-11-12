// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CreditLimitPanel } from './CreditLimitPanels'

afterEach(cleanup)

function renderPanel(props: Partial<Parameters<typeof CreditLimitPanel>[0]> = {}) {
  return render(
    <CreditLimitPanel
      creditData={undefined}
      isLoading={false}
      creditExceeded={false}
      netAmount={0}
      onRetry={vi.fn()}
      {...props}
    />,
  )
}

describe('CreditLimitPanel', () => {
  it('muestra Reintentar cuando falta el cupo y llama onRetry al hacer clic', () => {
    const onRetry = vi.fn()
    renderPanel({ onRetry })
    expect(screen.getByText(/No se pudo consultar el cupo/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('solo muestra Consultando cupo mientras carga', () => {
    renderPanel({ isLoading: true })
    expect(screen.getByText('Consultando cupo...')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
  })
})
