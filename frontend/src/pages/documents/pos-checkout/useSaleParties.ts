import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { getThirdParties } from '@/services/third-parties.service'
import { useCustomerBranches } from '@/hooks/useCustomerBranches'
import type { ComboboxOption } from '@/components/shared'
import type { DocumentDetail } from '@/types/document.types'
import type { ThirdParty } from '@/types/third-party.types'

export function useSaleParties() {
  // ── cliente ────────────────────────────────────────────────────────────────
  const [thirdPartyId, setThirdPartyId] = useState('')
  const [tpSelectedName, setTpSelectedName] = useState('')
  const [customerBranchId, setCustomerBranchId] = useState('')
  const [tpSearch, setTpSearch] = useState('')
  const [debouncedTpSearch] = useDebounce(tpSearch, 400)
  const hasTpSearch = debouncedTpSearch.length >= 1

  const { data: tpData, isLoading: isLoadingTp } = useQuery({
    queryKey: ['third-parties-search-pos-customer', debouncedTpSearch],
    queryFn: () =>
      getThirdParties({
        search: debouncedTpSearch || undefined,
        page: 1,
        limit: 30,
        isCustomer: true,
      }),
    staleTime: 2 * 60 * 1000,
    enabled: hasTpSearch,
  })

  const tpOptions: ComboboxOption[] = (tpData?.items ?? []).map((tp: ThirdParty) => ({
    id: tp.id,
    label: tp.name,
  }))
  const tpDisplayOptions: ComboboxOption[] =
    thirdPartyId && !debouncedTpSearch
      ? [
          { id: thirdPartyId, label: tpSelectedName },
          ...tpOptions.filter((o) => o.id !== thirdPartyId),
        ]
      : tpOptions

  const { branches: customerBranches, isLoading: isLoadingBranches } =
    useCustomerBranches(thirdPartyId)
  const needsBranch = customerBranches.length > 0

  // ── vendedor ───────────────────────────────────────────────────────────────
  const [sellerId, setSellerId] = useState('')
  const [sellerSelectedName, setSellerSelectedName] = useState('')
  const [sellerSearch, setSellerSearch] = useState('')
  const [debouncedSellerSearch] = useDebounce(sellerSearch, 400)
  const hasSellerSearch = debouncedSellerSearch.length >= 1

  const { data: sellerData, isLoading: isLoadingSeller } = useQuery({
    queryKey: ['third-parties-search-pos-seller', debouncedSellerSearch],
    queryFn: () =>
      getThirdParties({
        search: debouncedSellerSearch || undefined,
        page: 1,
        limit: 30,
        isSeller: true,
      }),
    staleTime: 2 * 60 * 1000,
    enabled: hasSellerSearch,
  })

  const sellerOptions: ComboboxOption[] = (sellerData?.items ?? []).map((tp: ThirdParty) => ({
    id: tp.id,
    label: tp.name,
  }))
  const sellerDisplayOptions: ComboboxOption[] =
    sellerId && !debouncedSellerSearch
      ? [
          { id: sellerId, label: sellerSelectedName },
          ...sellerOptions.filter((o) => o.id !== sellerId),
        ]
      : sellerOptions

  function selectCustomer(id: string, label: string) {
    setThirdPartyId(id)
    setTpSelectedName(label)
    setCustomerBranchId('')
  }

  function selectSeller(id: string, label: string) {
    setSellerId(id)
    setSellerSelectedName(label)
  }

  function loadFromDocument(doc: DocumentDetail) {
    setThirdPartyId(doc.thirdParty?.id ?? '')
    setTpSelectedName(doc.thirdParty?.name ?? '')
    setCustomerBranchId(doc.customerBranch?.id ?? '')
    setSellerId(doc.seller?.id ?? '')
    setSellerSelectedName(doc.seller?.name ?? '')
  }

  return {
    thirdPartyId,
    customerBranchId,
    setCustomerBranchId,
    tpSearch,
    setTpSearch,
    tpDisplayOptions,
    isLoadingTp,
    customerBranches,
    isLoadingBranches,
    needsBranch,
    sellerId,
    sellerSearch,
    setSellerSearch,
    sellerDisplayOptions,
    isLoadingSeller,
    selectCustomer,
    selectSeller,
    loadFromDocument,
  }
}

export type SaleParties = ReturnType<typeof useSaleParties>
