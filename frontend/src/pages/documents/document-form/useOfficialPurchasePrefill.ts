import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { UseFieldArrayReplace, UseFormSetValue } from 'react-hook-form'
import { getDocument } from '@/services/documents.service'
import { removeOfficialTax } from '@/lib/tax'
import type { DocumentSourceRef } from '@/types/document.types'
import type { FormValues } from '../document-form.schema'
import type { DocumentParties } from './useDocumentParties'
import type { ScannedProductInfo } from './useDocumentItems'

interface UseOfficialPurchasePrefillArgs {
  isEditing: boolean
  docType: FormValues['type']
  fromCMId: string | null
  setValue: UseFormSetValue<FormValues>
  replace: UseFieldArrayReplace<FormValues, 'items'>
  parties: DocumentParties
  setSourceRef: (ref: DocumentSourceRef | null) => void
  setScannedProductInfo: (info: ScannedProductInfo) => void
}

export function useOfficialPurchasePrefill({
  isEditing,
  docType,
  fromCMId,
  setValue,
  replace,
  parties,
  setSourceRef,
  setScannedProductInfo,
}: UseOfficialPurchasePrefillArgs) {
  const { setTpSelectedName, setSelectedSupplierBrandIds } = parties
  const prefilledFromCMRef = useRef(false)

  // Prefill desde la bandeja: proveedor, factura, ítems y precios de la CM origen, todo editable.
  const { data: fromCMDoc } = useQuery({
    queryKey: ['document', fromCMId],
    queryFn: () => getDocument(fromCMId!),
    enabled: !isEditing && docType === 'CMO' && Boolean(fromCMId),
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!fromCMDoc || prefilledFromCMRef.current) return
    prefilledFromCMRef.current = true
    if (
      fromCMDoc.type !== 'CM' ||
      fromCMDoc.status !== 'confirmed' ||
      !fromCMDoc.officialPurchase
    ) {
      toast.error('La compra de origen no es una compra oficial confirmada')
      return
    }
    setTpSelectedName(fromCMDoc.thirdParty?.name ?? '')
    setSelectedSupplierBrandIds(fromCMDoc.thirdParty?.supplier?.brands.map((b) => b.id) ?? [])
    setScannedProductInfo(
      Object.fromEntries(
        fromCMDoc.documentItems.map((item) => [
          item.productId,
          { avgCost: Number(item.product.avgCost), unitOfMeasure: item.product.unitOfMeasure },
        ]),
      ),
    )
    setSourceRef({ id: fromCMDoc.id, type: fromCMDoc.type, number: fromCMDoc.number })
    setValue('thirdPartyId', fromCMDoc.thirdParty?.id ?? undefined)
    setValue('supplierInvoiceNumber', fromCMDoc.supplierInvoiceNumber ?? undefined)
    setValue('sourceDocumentId', fromCMDoc.id)
    replace(
      fromCMDoc.documentItems.map((item) => ({
        productId: item.productId,
        productCode: item.product.code,
        productDesc: item.product.description,
        quantity: item.quantity,
        unitCost: removeOfficialTax(Number(item.unitCost)),
        unitPrice: undefined,
        observaciones: undefined,
        addedAt: new Date().toISOString(),
      })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCMDoc, setValue, replace])
}
