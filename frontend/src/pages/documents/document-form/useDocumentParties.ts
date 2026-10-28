import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import type { UseFormWatch } from 'react-hook-form'
import { getThirdParties } from '@/services/third-parties.service'
import { useCustomerBranches } from '@/hooks/useCustomerBranches'
import type { ComboboxOption } from '@/components/shared'
import type { ThirdParty } from '@/types/third-party.types'
import type { FormValues } from '../document-form.schema'
import type { DocumentTypeFlags } from './documentTypeFlags'

export function useDocumentParties(
  watch: UseFormWatch<FormValues>,
  { needsSupplier, needsCustomer, needsSeller, needsReceiver }: DocumentTypeFlags,
) {
  // Búsqueda de tercero: proveedor en compras y devoluciones, cliente en preventas y remisiones.
  const [tpSearch, setTpSearch] = useState('')
  const [debouncedTpSearch] = useDebounce(tpSearch, 400)
  const [tpSelectedName, setTpSelectedName] = useState('')
  // Marcas activas del proveedor elegido (solo compras y devoluciones): el buscador y el
  // escaneo de productos quedan restringidos a esas marcas.
  const [selectedSupplierBrandIds, setSelectedSupplierBrandIds] = useState<string[]>([])
  // Condiciones de descuento del proveedor elegido, solo informativas (no se calcula nada).
  // Se muestran en un aviso, solo en compras.
  const [selectedSupplierDiscountNotes, setSelectedSupplierDiscountNotes] = useState<
    string | undefined
  >()

  // Vendedora: solo preventas y remisiones.
  const [sellerSearch, setSellerSearch] = useState('')
  const [debouncedSellerSearch] = useDebounce(sellerSearch, 400)
  const [sellerSelectedName, setSellerSelectedName] = useState('')
  const [receiverSearch, setReceiverSearch] = useState('')
  const [debouncedReceiverSearch] = useDebounce(receiverSearch, 400)
  const [receiverSelectedName, setReceiverSelectedName] = useState('')

  const hasTpSearch = debouncedTpSearch.length >= 1

  const { data: tpData, isLoading: isLoadingTp } = useQuery({
    queryKey: ['third-parties-search', debouncedTpSearch, needsCustomer],
    queryFn: () =>
      getThirdParties({
        search: debouncedTpSearch || undefined,
        page: 1,
        limit: 30,
        isSupplier: needsSupplier ? true : undefined,
        isCustomer: needsCustomer ? true : undefined,
      }),
    staleTime: 2 * 60 * 1000,
    enabled: (needsSupplier || needsCustomer) && hasTpSearch,
  })

  const hasSellerSearch = debouncedSellerSearch.length >= 1

  const { data: sellerData, isLoading: isLoadingSeller } = useQuery({
    queryKey: ['third-parties-search-seller', debouncedSellerSearch],
    queryFn: () =>
      getThirdParties({
        search: debouncedSellerSearch || undefined,
        page: 1,
        limit: 30,
        isSeller: true,
      }),
    staleTime: 2 * 60 * 1000,
    enabled: needsSeller && hasSellerSearch,
  })

  const hasReceiverSearch = debouncedReceiverSearch.length >= 1

  const { data: receiverData, isLoading: isLoadingReceiver } = useQuery({
    queryKey: ['third-parties-search-receiver', debouncedReceiverSearch],
    queryFn: () =>
      getThirdParties({
        search: debouncedReceiverSearch || undefined,
        page: 1,
        limit: 30,
        isReceiver: true,
      }),
    staleTime: 2 * 60 * 1000,
    enabled: needsReceiver && hasReceiverSearch,
  })

  // Opciones de tercero: proveedor en compras y devoluciones, cliente en preventas y remisiones.
  const tpOptions: ComboboxOption[] = (tpData?.items ?? []).map((tp: ThirdParty) => ({
    id: tp.id,
    label: tp.name,
    sublabel: needsCustomer ? undefined : tp.isSupplier ? 'Proveedor' : undefined,
  }))

  const currentTpId = watch('thirdPartyId') ?? ''
  const { branches: customerBranches, isLoading: isLoadingBranches } = useCustomerBranches(
    needsCustomer ? currentTpId : undefined,
  )

  const tpDisplayOptions: ComboboxOption[] =
    currentTpId && !debouncedTpSearch
      ? [
          { id: currentTpId, label: tpSelectedName },
          ...tpOptions.filter((o) => o.id !== currentTpId),
        ]
      : tpOptions

  // Opciones de vendedora: solo preventas y remisiones.
  const sellerOptions: ComboboxOption[] = (sellerData?.items ?? []).map((tp: ThirdParty) => ({
    id: tp.id,
    label: tp.name,
  }))

  const currentSellerId = watch('sellerId') ?? ''

  const sellerDisplayOptions: ComboboxOption[] =
    currentSellerId && !debouncedSellerSearch
      ? [
          { id: currentSellerId, label: sellerSelectedName },
          ...sellerOptions.filter((o) => o.id !== currentSellerId),
        ]
      : sellerOptions

  const receiverOptions: ComboboxOption[] = (receiverData?.items ?? []).map((tp: ThirdParty) => ({
    id: tp.id,
    label: tp.name,
  }))

  const currentReceiverId = watch('receiverId') ?? ''

  const receiverDisplayOptions: ComboboxOption[] =
    currentReceiverId && !debouncedReceiverSearch
      ? [
          { id: currentReceiverId, label: receiverSelectedName },
          ...receiverOptions.filter((o) => o.id !== currentReceiverId),
        ]
      : receiverOptions

  const findThirdParty = (thirdPartyId: string) =>
    tpData?.items.find((t: ThirdParty) => t.id === thirdPartyId)

  const clearSelections = () => {
    setTpSelectedName('')
    setSellerSelectedName('')
    setReceiverSelectedName('')
    setSelectedSupplierBrandIds([])
    setSelectedSupplierDiscountNotes(undefined)
  }

  return {
    tpSearch,
    setTpSearch,
    tpSelectedName,
    setTpSelectedName,
    isLoadingTp,
    tpDisplayOptions,
    currentTpId,
    findThirdParty,
    customerBranches,
    isLoadingBranches,
    selectedSupplierBrandIds,
    setSelectedSupplierBrandIds,
    selectedSupplierDiscountNotes,
    setSelectedSupplierDiscountNotes,
    sellerSearch,
    setSellerSearch,
    setSellerSelectedName,
    isLoadingSeller,
    sellerDisplayOptions,
    receiverSearch,
    setReceiverSearch,
    setReceiverSelectedName,
    isLoadingReceiver,
    receiverDisplayOptions,
    clearSelections,
  }
}

export type DocumentParties = ReturnType<typeof useDocumentParties>
