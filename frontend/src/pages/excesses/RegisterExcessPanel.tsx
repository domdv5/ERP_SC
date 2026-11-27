import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { toast } from 'sonner'
import { Loader2, ShieldCheck } from 'lucide-react'
import type { ExcessPartyType } from '@contracts/excesses'

import { createExcess } from '@/services/excesses.service'
import { getThirdParties } from '@/services/third-parties.service'
import { useCustomerBranches } from '@/hooks/useCustomerBranches'
import { Combobox, SegmentedToggle, ThousandsInput } from '@/components/shared'
import type { ComboboxOption } from '@/components/shared'
import { getApiErrorMessage } from '@/lib/api-error'
import { todayInBogota } from '@/lib/format'
import { buildCreateExcessBody, findExcessFormError, NO_BRANCH } from './excess.rules'

interface RegisterExcessPanelProps {
  // Pestaña activa de la lista: el panel arranca con ese tipo
  initialPartyType: ExcessPartyType
}

export function RegisterExcessPanel({ initialPartyType }: RegisterExcessPanelProps) {
  const queryClient = useQueryClient()
  const today = todayInBogota()

  const [partyType, setPartyType] = useState<ExcessPartyType>(initialPartyType)
  const [thirdPartyId, setThirdPartyId] = useState('')
  const [thirdPartyName, setThirdPartyName] = useState('')
  const [thirdPartySearch, setThirdPartySearch] = useState('')
  const [branchId, setBranchId] = useState('')
  const [amount, setAmount] = useState<number | undefined>(undefined)
  const [date, setDate] = useState(today)
  const [error, setError] = useState<string | null>(null)
  // Se marca al instante: un doble clic rápido no crea dos excedentes
  const isSubmittingRef = useRef(false)

  const isCustomer = partyType === 'customer'
  const [debouncedSearch] = useDebounce(thirdPartySearch, 400)

  const { data: searchData, isLoading: isLoadingParties } = useQuery({
    queryKey: ['third-parties-search-excess', partyType, debouncedSearch],
    queryFn: () =>
      getThirdParties({
        search: debouncedSearch,
        page: 1,
        limit: 30,
        isCustomer: isCustomer ? true : undefined,
        isSupplier: isCustomer ? undefined : true,
      }),
    staleTime: 2 * 60 * 1000,
    enabled: debouncedSearch.length >= 1,
  })

  const { branches, isLoading: isLoadingBranches } = useCustomerBranches(
    isCustomer && thirdPartyId ? thirdPartyId : undefined,
  )
  const hasBranches = isCustomer && branches.length > 0

  const searchOptions: ComboboxOption[] = (searchData?.items ?? []).map((party) => ({
    id: party.id,
    label: party.name,
    sublabel: party.documentNumber,
  }))
  const partyOptions =
    thirdPartyId && !debouncedSearch
      ? [
          { id: thirdPartyId, label: thirdPartyName },
          ...searchOptions.filter((option) => option.id !== thirdPartyId),
        ]
      : searchOptions

  const { mutateAsync, isPending } = useMutation({ mutationFn: createExcess })

  function changePartyType(next: ExcessPartyType) {
    setPartyType(next)
    setThirdPartyId('')
    setThirdPartyName('')
    setThirdPartySearch('')
    setBranchId('')
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const values = { thirdPartyId, hasBranches, branchId, amount, date, today }
    const formError = findExcessFormError(values)
    if (formError) return setError(formError)
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setError(null)

    try {
      await mutateAsync(buildCreateExcessBody(partyType, values))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['excesses'] }),
        queryClient.invalidateQueries({ queryKey: ['credits'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts-payable'] }),
      ])
      toast.success('Excedente registrado correctamente')
      setThirdPartyId('')
      setThirdPartyName('')
      setThirdPartySearch('')
      setBranchId('')
      setAmount(undefined)
      setDate(todayInBogota())
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Error al registrar el excedente'))
    } finally {
      isSubmittingRef.current = false
    }
  }

  const branchName =
    branchId && branchId !== NO_BRANCH
      ? branches.find((branch) => branch.id === branchId)?.name
      : undefined
  const receiptScope = branchName
    ? 'esa sucursal'
    : hasBranches && !branchId
      ? 'la sucursal que elijas'
      : 'sus cuentas sin sucursal'
  const partyLabel = thirdPartyName
    ? branchName
      ? `${thirdPartyName} — ${branchName}`
      : thirdPartyName
    : null

  return (
    <aside
      aria-label="Registrar excedente"
      className="card-hard self-start border-l-[6px] border-l-brand-secondary"
    >
      <div className="px-5 py-3 border-b-2 border-ui-border-medium">
        <h2 className="text-base text-content">Registrar excedente</h2>
        <p className="text-xs text-content-muted">Queda disponible de inmediato</p>
      </div>
      <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-content-secondary">
            A favor de <span className="text-red-500">*</span>
          </span>
          <SegmentedToggle
            checked={!isCustomer}
            onChange={(checked) => changePartyType(checked ? 'supplier' : 'customer')}
            uncheckedLabel="Cliente"
            checkedLabel="Proveedor"
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-semibold text-content-secondary">
            {isCustomer ? 'Cliente' : 'Proveedor'} <span className="text-red-500">*</span>
          </span>
          <Combobox
            value={thirdPartyId}
            onChange={(id, option) => {
              setThirdPartyId(id)
              setThirdPartyName(option.label)
              setBranchId('')
              setError(null)
            }}
            options={partyOptions}
            isLoading={isLoadingParties}
            placeholder={isCustomer ? 'Busca un cliente...' : 'Busca un proveedor...'}
            searchValue={thirdPartySearch}
            onSearchChange={setThirdPartySearch}
            disabled={isPending}
          />
          <p className="text-xs text-content-muted">
            {isCustomer
              ? 'Solo busca terceros marcados como cliente.'
              : 'Solo busca terceros marcados como proveedor.'}
          </p>
        </div>

        {isCustomer && thirdPartyId && isLoadingBranches && (
          <div className="h-10 rounded-md bg-surface-hover animate-pulse" />
        )}
        {hasBranches && (
          <div className="space-y-1.5">
            <label
              htmlFor="excess-branch"
              className="block text-xs font-semibold text-content-secondary"
            >
              Sucursal <span className="text-red-500">*</span>
            </label>
            <select
              id="excess-branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              disabled={isPending}
              className="input-hard w-full px-3 py-2 text-sm text-content border-ui-border-medium"
            >
              <option value="">Selecciona una sucursal...</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
              <option value={NO_BRANCH}>Sin sucursal (cuentas de la sede)</option>
            </select>
            <p className="text-xs text-content-muted">
              Este cliente tiene {branches.length}{' '}
              {branches.length === 1 ? 'sucursal' : 'sucursales'}: elige a cuál pertenece la plata.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="excess-amount"
              className="block text-xs font-semibold text-content-secondary"
            >
              Valor <span className="text-red-500">*</span>
            </label>
            <ThousandsInput
              id="excess-amount"
              value={amount}
              onChange={setAmount}
              placeholder="0"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="excess-date"
              className="block text-xs font-semibold text-content-secondary"
            >
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              id="excess-date"
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              disabled={isPending}
              className="input-hard w-full px-3 py-2 text-sm text-content border-ui-border-medium"
            />
          </div>
        </div>

        {partyLabel && (
          <div className="flex items-start gap-2 p-3 border-2 border-ui-border-medium bg-surface-raised rounded-sm text-sm text-content-secondary">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Solo <b className="text-content">{partyLabel}</b> lo podrá usar, completo, en{' '}
              {isCustomer ? `un recibo de caja de ${receiptScope}.` : 'un egreso a su nombre.'}
            </span>
          </div>
        )}

        {error && <p className="text-xs text-red-500 font-accent">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="btn-primary flex items-center justify-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Registrar excedente
        </button>
      </form>
    </aside>
  )
}
