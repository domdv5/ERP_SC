import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { UseFormReset } from 'react-hook-form'
import { getDocument } from '@/services/documents.service'
import { todayInBogota } from '@/lib/format'
import type { DocumentSourceRef } from '@/types/document.types'
import type { FormValues } from '../document-form.schema'
import type { DocumentParties } from './useDocumentParties'
import type { ScannedProductInfo } from './useDocumentItems'

interface UseExistingDocumentArgs {
  id: string | undefined
  isEditing: boolean
  reset: UseFormReset<FormValues>
  parties: DocumentParties
  setSourceRef: (ref: DocumentSourceRef | null) => void
  setScannedProductInfo: (info: ScannedProductInfo) => void
}

export function useExistingDocument({
  id,
  isEditing,
  reset,
  parties,
  setSourceRef,
  setScannedProductInfo,
}: UseExistingDocumentArgs) {
  const navigate = useNavigate()
  const {
    setTpSelectedName,
    setSellerSelectedName,
    setReceiverSelectedName,
    setSelectedSupplierBrandIds,
    setSelectedSupplierDiscountNotes,
  } = parties

  const { data: existingDoc, isLoading: isLoadingDoc } = useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocument(id!),
    enabled: isEditing,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!existingDoc) return
    if (existingDoc.status !== 'draft') {
      toast.error('Solo se pueden editar operaciones en estado borrador')
      navigate(`/documents/${existingDoc.id}`)
      return
    }
    // Un borrador de venta no se edita acá (sin cliente/vendedora/forma de pago/cupo en este form genérico); se retoma desde el checkout.
    if (existingDoc.type === 'POS' || existingDoc.type === 'COT' || existingDoc.type === 'POSO') {
      navigate(`/documents/pos/new?draft=${existingDoc.id}`, { replace: true })
      return
    }
    // RMDVC y PE existen en el enum pero ningún flujo los crea ni los edita.
    if (existingDoc.type === 'RMDVC' || existingDoc.type === 'PE') {
      navigate(`/documents/${existingDoc.id}`, { replace: true })
      return
    }
    setTpSelectedName(existingDoc.thirdParty?.name ?? '')
    setSellerSelectedName(existingDoc.seller?.name ?? '')
    setReceiverSelectedName(existingDoc.receiver?.name ?? '')
    setSelectedSupplierBrandIds(existingDoc.thirdParty?.supplier?.brands.map((b) => b.id) ?? [])
    setSelectedSupplierDiscountNotes(existingDoc.thirdParty?.supplier?.discountNotes ?? undefined)
    setSourceRef(existingDoc.type === 'CMO' ? existingDoc.sourceDocument : null)
    setScannedProductInfo(
      Object.fromEntries(
        existingDoc.documentItems.map((item) => [
          item.productId,
          {
            avgCost: Number(item.product.avgCost),
            unitOfMeasure: item.product.unitOfMeasure,
          },
        ]),
      ),
    )
    reset({
      type: existingDoc.type,
      // La remisión siempre queda con la fecha del día; el backend la vuelve a fijar al guardar
      date: existingDoc.type === 'REM' ? todayInBogota() : existingDoc.date.slice(0, 10),
      thirdPartyId: existingDoc.thirdParty?.id ?? undefined,
      sellerId: existingDoc.seller?.id ?? undefined,
      receiverId: existingDoc.receiver?.id ?? undefined,
      warehouseId: existingDoc.warehouse?.id ?? undefined,
      sourceBinId: existingDoc.sourceBinId ?? undefined,
      destWarehouseId: existingDoc.destWarehouse?.id ?? undefined,
      destBinId: existingDoc.destBin?.id ?? undefined,
      customerBranchId: existingDoc.customerBranch?.id ?? undefined,
      adjustmentReason: existingDoc.adjustmentReason ?? undefined,
      adjustmentReasonOther: existingDoc.adjustmentReasonOther ?? undefined,
      refundMethod: existingDoc.refundMethod ?? undefined,
      officialPurchase: existingDoc.officialPurchase ?? false,
      supplierInvoiceNumber: existingDoc.supplierInvoiceNumber ?? undefined,
      sourceDocumentId: existingDoc.type === 'CMO' ? existingDoc.sourceDocument?.id : undefined,
      notes: existingDoc.notes ?? undefined,
      items: existingDoc.documentItems.map((item) => ({
        productId: item.productId,
        productCode: item.product.code,
        productDesc: item.product.description,
        quantity: item.quantity,
        unitCost: Number(item.unitCost),
        unitPrice: Number(item.unitPrice),
        observaciones: item.observaciones ?? undefined,
        addedAt: item.addedAt,
      })),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDoc, reset, navigate])

  return { isLoadingDoc }
}
