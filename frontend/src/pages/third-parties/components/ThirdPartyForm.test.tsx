// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ThirdPartyDetail } from '@/types/third-party.types'
import { ThirdPartyForm } from './ThirdPartyForm'

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector: (s: { user: { permissions: string[] } }) => unknown) =>
    selector({
      user: { permissions: ['customer.credit.update', 'third-party.update', 'customer.update'] },
    }),
}))
vi.mock('@/hooks/useLocations', () => ({
  useDepartments: () => ({ data: [], isLoading: false }),
  useCities: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/lib/third-party-permissions', () => ({
  canAssignThirdPartyRole: () => true,
}))

const detail = {
  id: 'tp-1',
  name: 'Ana SAS',
  personType: 'juridica',
  documentType: 'NIT',
  documentNumber: '900123',
  customer: { creditLimit: '600000', branches: [] },
} as unknown as ThirdPartyDetail

function renderForm(defaultValues: ThirdPartyDetail = detail) {
  const onSubmit = vi.fn()
  render(
    <ThirdPartyForm
      open
      onClose={vi.fn()}
      onSubmit={onSubmit}
      isPending={false}
      defaultValues={defaultValues}
    />,
  )
  const input = screen.getByPlaceholderText('0') as HTMLInputElement
  return { onSubmit, input }
}

const submit = () => fireEvent.submit(document.querySelector('form') as HTMLFormElement)

describe('ThirdPartyForm límite de crédito', () => {
  afterEach(cleanup)

  it('al borrar todo el valor queda vacío y no repone el original', () => {
    const { input } = renderForm()
    expect(input.value).toBe('600.000')
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
  })

  it('al enviar tras borrar manda creditLimit 0', async () => {
    const { input, onSubmit } = renderForm()
    fireEvent.change(input, { target: { value: '' } })
    submit()
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].creditLimit).toBe(0)
  })

  it('se puede escribir un valor nuevo después de borrar', async () => {
    const { input, onSubmit } = renderForm()
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.change(input, { target: { value: '2500000' } })
    expect(input.value).toBe('2.500.000')
    submit()
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].creditLimit).toBe(2500000)
  })

  it('sin tocar el campo se envía el mismo valor', async () => {
    const { onSubmit } = renderForm()
    submit()
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].creditLimit).toBe(600000)
  })

  it('cliente sin límite y sin tocar el campo envía undefined', async () => {
    const { onSubmit } = renderForm({
      ...detail,
      customer: { creditLimit: null, branches: [] },
    } as unknown as ThirdPartyDetail)
    submit()
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].creditLimit).toBeUndefined()
  })
})
